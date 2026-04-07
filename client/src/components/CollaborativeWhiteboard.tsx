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
  const activePointsRef = useRef<WhiteboardPoint[]>([]);

  const lineWidth = useMemo(() => (tool === 'eraser' ? 20 : 3), [tool]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.floor(parent.clientWidth));
    const height = Math.max(240, Math.floor(parent.clientHeight));
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

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    store.whiteboardStrokes.forEach((stroke) => drawStroke(ctx, stroke));
  }, [drawStroke, store.whiteboardStrokes]);

  useEffect(() => {
    resizeCanvas();
    redraw();
    const onResize = () => {
      resizeCanvas();
      redraw();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [redraw, resizeCanvas]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getPoint = (event: React.MouseEvent<HTMLCanvasElement>): WhiteboardPoint | null => {
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

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    const point = getPoint(event);
    if (!point) return;
    drawingRef.current = true;
    activePointsRef.current = [point];
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = getPoint(event);
    if (!point) return;
    activePointsRef.current.push(point);
    previewSegment(activePointsRef.current);
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishStroke}
      onMouseLeave={finishStroke}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: enabled ? 'auto' : 'none',
        cursor: enabled ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
        zIndex: 3
      }}
    />
  );
});

export default CollaborativeWhiteboard;
