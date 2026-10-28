import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRetroStore } from '../store/StoreContext';
import { isFemininePersonName } from '../utils/feminineName';
import './FloorCat.css';

type GameStatus = 'ready' | 'play' | 'lost';

type BoxKind = 'small' | 'tall' | 'wide' | 'pair' | 'triple' | 'pyramid';

type BoxPart = { x: number; y: number; w: number; h: number };

type Obstacle = {
  x: number;
  w: number;
  h: number;
  kind: BoxKind;
  parts: BoxPart[];
  node: HTMLDivElement;
};

const metersWord = (value: number) => {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'метр';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'метра';
  return 'метров';
};

const CAT_W = 46;
const CAT_H = 32;
const CAT_X_FALLBACK = 320;
const GRAVITY = 1600;
const HOLD_GRAVITY = 980;
const JUMP_V = -430;
const START_SPEED = 210;
const MAX_SPEED = 520;
const LEVEL_STEP = 270;
const PYRAMID_UNIT = 24;
const BOX_GAP = 2;

const levelFromScore = (value: number) => 1 + Math.floor(Math.max(0, value) / LEVEL_STEP);

const crateRow = (count: number, size: number): BoxPart[] =>
  Array.from({ length: count }, (_, index) => ({
    x: index * (size + BOX_GAP),
    y: 0,
    w: size,
    h: size
  }));

const boxLayout = (kind: BoxKind): { w: number; h: number; parts: BoxPart[] } => {
  if (kind === 'small') return { w: 30, h: 28, parts: [{ x: 0, y: 0, w: 30, h: 28 }] };
  if (kind === 'tall') return { w: 34, h: 46, parts: [{ x: 0, y: 0, w: 34, h: 46 }] };
  if (kind === 'wide') return { w: 58, h: 30, parts: [{ x: 0, y: 0, w: 58, h: 30 }] };
  if (kind === 'pair') {
    const parts = crateRow(2, 30);
    return { w: 62, h: 30, parts };
  }
  if (kind === 'triple') {
    const parts = crateRow(3, 28);
    return { w: 88, h: 28, parts };
  }
  const u = PYRAMID_UNIT;
  return {
    w: u * 2,
    h: u * 2,
    parts: [
      { x: 0, y: 0, w: u, h: u },
      { x: u, y: 0, w: u, h: u },
      { x: u / 2, y: u, w: u, h: u }
    ]
  };
};

const isTypingTarget = (target: EventTarget | null) =>
  Boolean((target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]'));

const boardCatX = () => {
  const board = document.querySelector('[data-cat-run-board]');
  if (!(board instanceof HTMLElement)) return CAT_X_FALLBACK;
  return Math.round(board.getBoundingClientRect().left + 10);
};

const CatRunGame: React.FC = observer(() => {
  const themeMode = useTheme().palette.mode;
  const store = useRetroStore();
  const withBow = isFemininePersonName(store.currentUser?.name || store.authProfile?.name);
  const actorRef = useRef<HTMLButtonElement | null>(null);
  const catRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const jumpRef = useRef<() => void>(() => {});
  const restartRef = useRef<() => void>(() => {});
  const statusRef = useRef<GameStatus>('play');
  const [status, setStatus] = useState<GameStatus>('play');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);

  const setGameStatus = (next: GameStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const playTone = (frequency: number, duration = 0.06) => {
    try {
      const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      if (!audioRef.current) audioRef.current = new Context();
      const audio = audioRef.current;
      if (audio.state === 'closed') {
        audioRef.current = new Context();
      }
      const next = audioRef.current;
      if (!next || next.state === 'closed') return;
      if (next.state === 'suspended') void next.resume();
      const oscillator = next.createOscillator();
      const gain = next.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, next.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.03, next.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, next.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(next.destination);
      oscillator.start();
      oscillator.stop(next.currentTime + duration);
    } catch {
      // Ignore autoplay / closed-context failures so the run keeps going.
    }
  };

  useEffect(() => {
    const actor = actorRef.current;
    const cat = catRef.current;
    const track = trackRef.current;
    if (!actor || !cat || !track) return;

    const isDark = themeMode === 'dark';
    let frame = 0;
    let last = performance.now();
    let distance = 0;
    let speed = START_SPEED;
    let vy = 0;
    let y = 0;
    let holding = false;
    let spawnAt = 120;
    let catX = boardCatX();
    let shownLevel = 1;
    const obstacles: Obstacle[] = [];

    const boxFill = isDark ? '#c4a574' : '#b08958';
    const boxBorder = isDark ? 'rgba(62,42,18,0.55)' : 'rgba(62,42,18,0.35)';
    const boxShadow = isDark
      ? '0 1px 0 rgba(255,244,220,0.25) inset, 0 2px 6px rgba(0,0,0,0.35)'
      : '0 1px 0 rgba(255,255,255,0.35) inset, 0 2px 5px rgba(0,0,0,0.18)';
    const tapeFill = isDark ? 'rgba(255,244,220,0.45)' : 'rgba(255,255,255,0.45)';

    const paintCrate = (node: HTMLElement, part: BoxPart) => {
      node.style.cssText = [
        'position:absolute',
        `left:${part.x}px`,
        `bottom:${part.y}px`,
        `width:${part.w}px`,
        `height:${part.h}px`,
        `background:${boxFill}`,
        `border:1px solid ${boxBorder}`,
        'border-radius:3px',
        `box-shadow:${boxShadow}`,
        'pointer-events:none',
      ].join(';');
      const tape = document.createElement('span');
      tape.style.cssText = `position:absolute;left:18%;right:18%;top:42%;height:2px;background:${tapeFill}`;
      node.appendChild(tape);
    };

    const paintBox = (node: HTMLDivElement, box: Obstacle) => {
      node.style.cssText = [
        'position:absolute',
        'left:0',
        'bottom:0',
        `width:${box.w}px`,
        `height:${box.h}px`,
        `transform:translate3d(${box.x}px,0,0)`,
        'background:transparent',
        'pointer-events:none',
      ].join(';');
      node.replaceChildren();
      box.parts.forEach((part) => {
        const crate = document.createElement('div');
        paintCrate(crate, part);
        node.appendChild(crate);
      });
    };

    const clearBoxes = () => {
      obstacles.splice(0).forEach((item) => item.node.remove());
    };

    const resetWorld = () => {
      distance = 0;
      speed = START_SPEED;
      vy = 0;
      y = 0;
      holding = false;
      spawnAt = 120;
      catX = boardCatX();
      shownLevel = 1;
      clearBoxes();
      actor.style.transform = `translate3d(${catX}px, 0, 0)`;
      cat.dataset.mood = 'play';
      setScore(0);
      setLevel(1);
    };

    const makeObstacle = (currentLevel: number): Obstacle => {
      const startX = window.innerWidth + 16;
      const roll = Math.random();
      let kind: BoxKind = 'small';
      if (currentLevel >= 2 && roll < 0.16) kind = 'pyramid';
      else if (roll < 0.28) kind = 'small';
      else if (roll < 0.46) kind = 'pair';
      else if (currentLevel >= 2 && roll < 0.64) kind = 'triple';
      else if (roll < 0.8) kind = currentLevel >= 2 ? 'tall' : 'wide';
      else kind = 'wide';
      const layout = boxLayout(kind);
      const node = document.createElement('div');
      const box: Obstacle = {
        x: startX,
        w: layout.w,
        h: layout.h,
        kind,
        parts: layout.parts,
        node
      };
      paintBox(node, box);
      track.appendChild(node);
      return box;
    };

    const jump = () => {
      if (statusRef.current !== 'play') {
        resetWorld();
        setGameStatus('play');
      }
      if (y === 0 && vy === 0) {
        vy = JUMP_V;
        playTone(520, 0.05);
      }
      holding = true;
    };
    jumpRef.current = jump;
    restartRef.current = () => {
      resetWorld();
      setGameStatus('play');
    };

    const publishScore = () => {
      const nextScore = Math.floor(distance / 8);
      store.recordCatRunScore(nextScore, levelFromScore(nextScore));
    };

    const lose = () => {
      if (statusRef.current !== 'play') return;
      publishScore();
      cat.dataset.mood = 'sit';
      setGameStatus('lost');
      playTone(160, 0.18);
    };

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      try {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;

      if (statusRef.current === 'play') {
        distance += speed * dt;
        const nextScore = Math.floor(distance / 8);
        const nextLevel = levelFromScore(nextScore);
        speed = Math.min(MAX_SPEED, START_SPEED + (nextLevel - 1) * 36 + (nextScore % LEVEL_STEP) * 0.12);
        setScore((prev) => (prev === nextScore ? prev : nextScore));
        if (shownLevel !== nextLevel) {
          shownLevel = nextLevel;
          setLevel(nextLevel);
          playTone(660 + nextLevel * 40, 0.09);
        }

        const gravity = holding && vy < 0 ? HOLD_GRAVITY : GRAVITY;
        vy += gravity * dt;
        y = Math.min(0, y + vy * dt);
        if (y >= 0) {
          y = 0;
          vy = 0;
        }

        spawnAt -= speed * dt;
        if (spawnAt <= 0) {
          obstacles.push(makeObstacle(nextLevel));
          spawnAt = Math.max(340, 500 - nextLevel * 16) + Math.random() * Math.max(120, 240 - nextLevel * 10);
        }
        for (let i = obstacles.length - 1; i >= 0; i -= 1) {
          const obstacle = obstacles[i];
          obstacle.x -= speed * dt;
          obstacle.node.style.transform = `translate3d(${obstacle.x}px, 0, 0)`;
          if (obstacle.x + obstacle.w < -40) {
            obstacle.node.remove();
            obstacles.splice(i, 1);
          }
        }

        const catBox = {
          left: catX + 8,
          right: catX + CAT_W - 4,
          top: -CAT_H + y + 6,
          bottom: y - 1
        };
        const hit = obstacles.some((obstacle) => obstacle.parts.some((part) => {
          const left = obstacle.x + part.x + 1;
          const right = obstacle.x + part.x + part.w - 1;
          const top = -(part.y + part.h) + 1;
          const bottom = -part.y;
          return catBox.right > left && catBox.left < right && catBox.bottom > top && catBox.top < bottom;
        }));
        if (hit) lose();
      }

      catX = boardCatX();
      actor.style.transform = `translate3d(${catX}px, ${y.toFixed(1)}px, 0)`;
      } catch {
        // Keep the overlay running if a single frame fails.
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) return;
      if (event.code !== 'Space' && event.code !== 'ArrowUp') return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target;
      if (target instanceof HTMLElement) target.blur();
      jump();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') holding = false;
    };
    const onPointerUp = () => {
      holding = false;
    };

    resetWorld();
    setGameStatus('play');
    store.beginCatRunRound();
    frame = window.requestAnimationFrame(tick);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      if (statusRef.current === 'play') publishScore();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointerup', onPointerUp);
      clearBoxes();
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) void audio.close();
    };
  }, [themeMode, store]);

  return (
    <Box
      className="floor-cat"
      data-theme={themeMode}
      data-bow={withBow ? '1' : '0'}
      sx={{ zIndex: 1160 }}
    >
      <Box ref={trackRef} sx={{ position: 'absolute', inset: 'auto 0 0 0', height: 0, overflow: 'visible', pointerEvents: 'none' }} />
      <Box
        component="button"
        type="button"
        className="floor-cat__actor"
        ref={actorRef}
        aria-label="Кот в игре"
        onPointerDown={(event) => {
          event.preventDefault();
          jumpRef.current();
        }}
        sx={{ pointerEvents: 'auto' }}
      >
        <div className="floor-cat__flip">
          <div className="floor-cat__lift">
            <div className="cat" ref={catRef} data-mood="play">
              <div className="mover">
                <div className="tail" />
                <div className="leg leg-hind-far" />
                <div className="leg leg-front-far" />
                <div className="hip" />
                <div className="body" />
                <div className="leg leg-hind" />
                <div className="leg leg-front" />
                <div className="head">
                  <div className="ear ear-left" />
                  <div className="ear ear-right" />
                  <div className="bow" aria-hidden="true" />
                  <div className="eye eye-left" />
                  <div className="eye eye-right" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Box>
      <Box
        data-cat-run-ui
        sx={{
          position: 'fixed',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          pointerEvents: 'auto',
          px: 1.5,
          py: 0.85,
          borderRadius: 1.5,
          textAlign: 'center',
          color: '#fff',
          bgcolor: 'rgba(22, 18, 48, 0.82)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          minWidth: 200,
          maxWidth: 'min(440px, calc(100% - 24px))',
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', lineHeight: 1.25 }}>
          Уровень {level}
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', lineHeight: 1.3, opacity: 0.92 }}>
          {score} {metersWord(score)}
          {store.catRunBestScore > score ? ` · рекорд ${store.catRunBestScore}` : ''}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.86, mt: 0.15, fontSize: '0.7rem' }}>
          {status === 'lost'
            ? 'Кот врезался в коробку'
            : 'Пробел или клик по коту — прыжок'}
        </Typography>
        {status === 'lost' && (
          <Button
            data-cat-run-ui
            size="small"
            variant="contained"
            onClick={() => restartRef.current()}
            sx={{ mt: 0.75, textTransform: 'none', fontWeight: 800, minHeight: 28 }}
          >
            Ещё раз
          </Button>
        )}
      </Box>
    </Box>
  );
});

export default CatRunGame;
