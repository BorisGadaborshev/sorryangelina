import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { RetroStore } from '../store/RetroStore';
import { WhiteboardPoint, WhiteboardStroke } from '../types';

interface Props {
  store: RetroStore;
  enabled: boolean;
  tool: 'pen' | 'eraser';
  color: string;
}

const CollaborativeWhiteboard: React.FC<Props> = observer(({ store, enabled, tool, color }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const activePointsRef = useRef<WhiteboardPoint[]>([]);

  const lineWidth = useMemo(() => (tool === 'eraser' ? 20 : 3), [tool]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(parent.clientWidth));
    const height = Math.max(1, Math.floor(parent.clientHeight));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) => {
    if (stroke.points.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }, []);

  const drawnCountRef = useRef(0);
  const strokesRef = useRef(store.whiteboardStrokes);
  strokesRef.current = store.whiteboardStrokes;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke));
    drawnCountRef.current = strokesRef.current.length;
  }, [drawStroke]);

  useEffect(() => {
    resizeCanvas();
    redraw();
    const onResize = () => {
      resizeCanvas();
      redraw();
    };
    window.addEventListener('resize', onResize);
    const parent = canvasRef.current?.parentElement;
    const observer = parent ? new ResizeObserver(onResize) : null;
    if (parent) observer?.observe(parent);
    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [redraw, resizeCanvas]);

  useEffect(() => {
    const strokes = store.whiteboardStrokes;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Local strokes are painted while drawing, so the stored list can shrink
    // back to zero without this effect having counted them. Always repaint then.
    if (strokes.length <= drawnCountRef.current) {
      redraw();
      return;
    }
    for (let index = drawnCountRef.current; index < strokes.length; index += 1) {
      drawStroke(ctx, strokes[index]);
    }
    drawnCountRef.current = strokes.length;
  }, [drawStroke, redraw, store.whiteboardStrokes.length]);

  const getPoint = (event: { clientX: number; clientY: number }): WhiteboardPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    };
  };

  const previewSegment = (points: WhiteboardPoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || points.length < 2) return;
    drawStroke(ctx, {
      id: 'preview',
      userId: store.currentUser?.id || 'unknown',
      color,
      width: lineWidth,
      tool,
      points: points.slice(-2)
    });
  };

  const appendPoint = (event: { clientX: number; clientY: number }) => {
    const point = getPoint(event);
    if (!point) return;
    activePointsRef.current.push(point);
    previewSegment(activePointsRef.current);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || !event.isPrimary || event.button !== 0) return;
    const point = getPoint(event);
    if (!point) return;
    event.preventDefault();
    drawingRef.current = true;
    activePointerRef.current = event.pointerId;
    activePointsRef.current = [point];
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers refuse capture until the pointer is active.
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || event.pointerId !== activePointerRef.current) return;
    event.preventDefault();
    const native = event.nativeEvent;
    const samples = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    (samples.length > 0 ? samples : [native]).forEach((sample) => appendPoint(sample));
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== activePointerRef.current) return;
    drawingRef.current = false;
    activePointerRef.current = null;
    const points = activePointsRef.current;
    activePointsRef.current = [];
    if (points.length < 2 || !store.currentUser) {
      redraw();
      return;
    }
    const stroke: WhiteboardStroke = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: store.currentUser.id,
      color,
      width: lineWidth,
      tool,
      points
    };
    store.addWhiteboardStroke(stroke);
    store.socketService?.sendWhiteboardStroke(stroke);
  };

  return (
    <canvas
      ref={canvasRef}
      data-whiteboard="board"
      aria-label="Холст для рисования"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        position: 'absolute',
        inset: 0,
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: enabled ? 'auto' : 'none',
        cursor: enabled ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
        zIndex: 3
      }}
    />
  );
});

export default CollaborativeWhiteboard;
