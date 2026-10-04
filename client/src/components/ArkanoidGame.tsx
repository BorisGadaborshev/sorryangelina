import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, Typography } from '@mui/material';
import { RetroStore, ARKANOID_HITS_TO_BREAK } from '../store/RetroStore';

interface Props {
  store: RetroStore;
}

type GameStatus = 'ready' | 'play' | 'lost' | 'won';

interface Brick {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const BALL_RADIUS = 8;
const PADDLE_HEIGHT = 14;
const PADDLE_BOTTOM = 18;
const BASE_SPEED = 360;
const MAX_SPEED = 640;

const circleHitsRect = (x: number, y: number, radius: number, brick: Brick): boolean => {
  const closestX = Math.max(brick.left, Math.min(x, brick.right));
  const closestY = Math.max(brick.top, Math.min(y, brick.bottom));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy <= radius * radius;
};

const normalizeVelocity = (vx: number, vy: number, speed: number) => {
  const length = Math.hypot(vx, vy) || 1;
  let nextVx = (vx / length) * speed;
  let nextVy = (vy / length) * speed;
  const minVy = speed * 0.28;
  if (Math.abs(nextVy) < minVy) {
    nextVy = nextVy < 0 ? -minVy : minVy;
    const sign = nextVx < 0 ? -1 : 1;
    nextVx = sign * Math.sqrt(Math.max(0, speed * speed - nextVy * nextVy));
  }
  return { vx: nextVx, vy: nextVy };
};


const ArkanoidGame: React.FC<Props> = observer(({ store }) => {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const paddleRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<GameStatus>('ready');
  const keysRef = useRef<Set<string>>(new Set());
  const pointerRef = useRef({ active: false, x: 0 });
  const audioRef = useRef<AudioContext | null>(null);
  const simRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    paddleX: 0,
    speed: BASE_SPEED,
    launched: false,
    initialized: false,
    contacts: new Set<string>(),
    targets: new Set<string>()
  });
  const [status, setStatus] = useState<GameStatus>('ready');
  const [visible, setVisible] = useState(false);
  const [targetCount, setTargetCount] = useState(0);

  const setGameStatus = (next: GameStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const playTone = (frequency: number, duration = 0.05) => {
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    if (!audioRef.current) audioRef.current = new Context();
    const audio = audioRef.current;
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, audio.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  };

  useEffect(() => {
    store.beginArkanoidRound();
    const sim = simRef.current;
    const keys = keysRef.current;

    let brickCache: Brick[] = [];
    let brickCacheAt = 0;
    const invalidateBricks = () => {
      brickCacheAt = 0;
    };

    const bricksInView = (): Brick[] => {
      const now = performance.now();
      if (brickCacheAt && now - brickCacheAt < 120) return brickCache;
      const currentField = fieldRef.current;
      if (!currentField) return [];
      const width = currentField.clientWidth;
      const height = currentField.clientHeight;
      const origin = currentField.getBoundingClientRect();
      const bricks: Brick[] = [];
      const nodes = currentField.parentElement?.querySelectorAll<HTMLElement>('[data-arkanoid-card]') ?? [];
      nodes.forEach((node) => {
        const id = node.dataset.arkanoidCard;
        if (!id || (store.arkanoidHits.get(id) || 0) >= ARKANOID_HITS_TO_BREAK) return;
        const rect = node.getBoundingClientRect();
        const left = rect.left - origin.left;
        const top = rect.top - origin.top;
        const right = rect.right - origin.left;
        const bottom = rect.bottom - origin.top;
        if (bottom < 0 || top > height || right < 0 || left > width) return;
        if (right - left < 8 || bottom - top < 8) return;
        bricks.push({ id, left, top, right, bottom });
      });
      brickCache = bricks;
      brickCacheAt = now;
      return bricks;
    };

    const launch = () => {
      if (sim.launched || statusRef.current === 'lost' || statusRef.current === 'won') return;
      const angle = Math.random() * 0.8 - 0.4;
      sim.speed = BASE_SPEED;
      sim.vx = Math.sin(angle) * sim.speed;
      sim.vy = -Math.cos(angle) * sim.speed;
      sim.launched = true;
      sim.contacts.clear();
      sim.targets = new Set(bricksInView().map((brick) => brick.id));
      setTargetCount(sim.targets.size);
      setGameStatus('play');
      playTone(440, 0.07);
    };

    const restart = () => {
      store.restartArkanoidRound();
      sim.launched = false;
      sim.vx = 0;
      sim.vy = 0;
      sim.speed = BASE_SPEED;
      sim.contacts.clear();
      sim.targets = new Set();
      setTargetCount(0);
      setGameStatus('ready');
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      keys.add(key);
      if (key === 'arrowleft' || key === 'arrowright' || key === 'a' || key === 'd' || key === 'ф' || key === 'в') {
        event.preventDefault();
      }
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (event.repeat) return;
      event.preventDefault();
      if (statusRef.current === 'ready') launch();
      else if (statusRef.current === 'lost' || statusRef.current === 'won') restart();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };

    const field = fieldRef.current;
    const onPointerMove = (event: PointerEvent) => {
      if (!field) return;
      const rect = field.getBoundingClientRect();
      pointerRef.current = { active: true, x: event.clientX - rect.left };
    };
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest('[data-arkanoid-ui]')) return;
      if (statusRef.current === 'ready') launch();
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', invalidateBricks);
    window.addEventListener('scroll', invalidateBricks, true);
    field?.addEventListener('pointermove', onPointerMove);
    field?.addEventListener('pointerdown', onPointerDown);
    field?.addEventListener('pointerleave', onPointerLeave);

    let frame = 0;
    let last = performance.now();

    const placeActors = (paddleWidth: number, paddleTop: number) => {
      const ball = ballRef.current;
      const paddle = paddleRef.current;
      if (ball) {
        ball.style.transform = `translate(${sim.x - BALL_RADIUS}px, ${sim.y - BALL_RADIUS}px)`;
      }
      if (paddle) {
        paddle.style.width = `${paddleWidth}px`;
        paddle.style.transform = `translate(${sim.paddleX - paddleWidth / 2}px, ${paddleTop}px)`;
      }
    };

    const step = (dt: number) => {
      const currentField = fieldRef.current;
      if (!currentField) return;
      const width = currentField.clientWidth;
      const height = currentField.clientHeight;
      if (width < 40 || height < 80) return;

      const paddleWidth = Math.max(86, Math.min(150, width * 0.18));
      const paddleTop = height - PADDLE_BOTTOM - PADDLE_HEIGHT;
      let paddleX = sim.paddleX;
      if (!sim.initialized) {
        paddleX = width / 2;
        sim.initialized = true;
        setVisible(true);
      }
      if (keys.has('arrowleft') || keys.has('a') || keys.has('ф')) paddleX -= 680 * dt;
      if (keys.has('arrowright') || keys.has('d') || keys.has('в')) paddleX += 680 * dt;
      if (pointerRef.current.active) paddleX = pointerRef.current.x;
      const half = paddleWidth / 2;
      sim.paddleX = Math.max(half, Math.min(width - half, paddleX));

      if (!sim.launched || statusRef.current !== 'play') {
        sim.x = sim.paddleX;
        sim.y = paddleTop - BALL_RADIUS - 1;
        placeActors(paddleWidth, paddleTop);
        return;
      }

      const bricks = bricksInView();

      const distance = Math.hypot(sim.vx, sim.vy) * dt;
      const steps = Math.max(1, Math.min(10, Math.ceil(distance / 6)));
      const stepDt = dt / steps;
      const touched = new Set<string>();

      for (let index = 0; index < steps; index += 1) {
        const prevX = sim.x;
        const prevY = sim.y;
        sim.x += sim.vx * stepDt;
        sim.y += sim.vy * stepDt;

        if (sim.x < BALL_RADIUS) {
          sim.x = BALL_RADIUS;
          sim.vx = Math.abs(sim.vx);
        } else if (sim.x > width - BALL_RADIUS) {
          sim.x = width - BALL_RADIUS;
          sim.vx = -Math.abs(sim.vx);
        }
        if (sim.y < BALL_RADIUS) {
          sim.y = BALL_RADIUS;
          sim.vy = Math.abs(sim.vy);
        }

        const paddle: Brick = {
          id: 'paddle',
          left: sim.paddleX - half,
          right: sim.paddleX + half,
          top: paddleTop,
          bottom: paddleTop + PADDLE_HEIGHT
        };
        if (sim.vy > 0 && circleHitsRect(sim.x, sim.y, BALL_RADIUS, paddle) && prevY + BALL_RADIUS <= paddle.top + 2) {
          const hit = Math.max(-1, Math.min(1, (sim.x - sim.paddleX) / half));
          const angle = hit * (Math.PI / 3);
          const velocity = normalizeVelocity(Math.sin(angle) * sim.speed, -Math.cos(angle) * sim.speed, sim.speed);
          sim.vx = velocity.vx;
          sim.vy = velocity.vy;
          sim.y = paddle.top - BALL_RADIUS - 0.5;
          playTone(220, 0.04);
        }

        let hitBrick: Brick | null = null;
        for (const brick of bricks) {
          if (!circleHitsRect(sim.x, sim.y, BALL_RADIUS, brick)) continue;
          touched.add(brick.id);
          if (!hitBrick) hitBrick = brick;
        }

        if (hitBrick && !sim.contacts.has(hitBrick.id)) {
          const brick: Brick = hitBrick;
          sim.contacts.add(brick.id);
          const fromLeft = prevX + BALL_RADIUS <= brick.left + 0.5;
          const fromRight = prevX - BALL_RADIUS >= brick.right - 0.5;
          const fromAbove = prevY + BALL_RADIUS <= brick.top + 0.5;
          const fromBelow = prevY - BALL_RADIUS >= brick.bottom - 0.5;
          if ((fromLeft || fromRight) && !(fromAbove || fromBelow)) {
            sim.vx *= -1;
            sim.x = fromLeft ? brick.left - BALL_RADIUS - 0.6 : brick.right + BALL_RADIUS + 0.6;
          } else {
            sim.vy *= -1;
            sim.y = fromAbove || !fromBelow ? brick.top - BALL_RADIUS - 0.6 : brick.bottom + BALL_RADIUS + 0.6;
          }
          const hits = store.recordArkanoidHit(brick.id);
          invalidateBricks();
          sim.speed = Math.min(MAX_SPEED, BASE_SPEED + store.arkanoidCardsBroken * 26);
          const velocity = normalizeVelocity(sim.vx, sim.vy, sim.speed);
          sim.vx = velocity.vx;
          sim.vy = velocity.vy;
          playTone(hits >= ARKANOID_HITS_TO_BREAK ? 880 : 520 + hits * 80, hits >= ARKANOID_HITS_TO_BREAK ? 0.09 : 0.045);
          const cleared = sim.targets.size > 0 && Array.from(sim.targets).every((id) => (store.arkanoidHits.get(id) || 0) >= ARKANOID_HITS_TO_BREAK);
          if (cleared) {
            sim.launched = false;
            setGameStatus('won');
            break;
          }
        } else if (hitBrick) {
          const brick: Brick = hitBrick;
          if (sim.y <= brick.top) sim.y = brick.top - BALL_RADIUS - 0.6;
          else if (sim.y >= brick.bottom) sim.y = brick.bottom + BALL_RADIUS + 0.6;
          else if (sim.x <= brick.left) sim.x = brick.left - BALL_RADIUS - 0.6;
          else sim.x = brick.right + BALL_RADIUS + 0.6;
        }

        if (sim.y - BALL_RADIUS > height) {
          sim.launched = false;
          setGameStatus('lost');
          playTone(140, 0.16);
          break;
        }
      }

      sim.contacts.forEach((id) => {
        if (!touched.has(id)) sim.contacts.delete(id);
      });
      placeActors(paddleWidth, paddleTop);
    };

    let paused = document.hidden;
    const onVisibility = () => {
      paused = document.hidden;
      last = performance.now();
      if (!paused) invalidateBricks();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const loop = (now: number) => {
      if (!paused) {
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        step(dt);
      } else {
        last = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', invalidateBricks);
      window.removeEventListener('scroll', invalidateBricks, true);
      field?.removeEventListener('pointermove', onPointerMove);
      field?.removeEventListener('pointerdown', onPointerDown);
      field?.removeEventListener('pointerleave', onPointerLeave);
      store.finishArkanoidRound();
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) void audio.close();
    };
  }, [store]);

  const score = store.arkanoidScore;
  const broken = store.arkanoidCardsBroken;
  const roundTotal = targetCount || store.cards.length;
  const headline = status === 'won' ? 'Все карточки разбиты' : status === 'lost' ? 'Шарик улетел' : '';
  const scoreWord = score % 10 === 1 && score % 100 !== 11
    ? 'очко'
    : score % 10 >= 2 && score % 10 <= 4 && (score % 100 < 10 || score % 100 >= 20)
      ? 'очка'
      : 'очков';

  return (
    <Box
      ref={fieldRef}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        touchAction: 'none',
        userSelect: 'none',
        cursor: status === 'play' || status === 'ready' ? 'none' : 'default'
      }}
    >
      <Box
        ref={ballRef}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: BALL_RADIUS * 2,
          height: BALL_RADIUS * 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #fff 0%, #ffe082 45%, #ff8f00 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          opacity: visible ? 1 : 0,
          zIndex: 2,
          pointerEvents: 'none'
        }}
      />
      <Box
        ref={paddleRef}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: PADDLE_HEIGHT,
          borderRadius: 999,
          background: 'linear-gradient(180deg, #8d86ff 0%, #5b54e8 100%)',
          boxShadow: '0 4px 10px rgba(91, 84, 232, 0.45)',
          opacity: visible ? 1 : 0,
          zIndex: 2,
          pointerEvents: 'none'
        }}
      />

      <Box
        data-arkanoid-ui
        sx={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          minWidth: 220,
          maxWidth: 'min(440px, calc(100% - 24px))',
          px: 1.5,
          py: 1,
          borderRadius: 1.5,
          textAlign: 'center',
          color: '#fff',
          bgcolor: 'rgba(22, 18, 48, 0.82)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          pointerEvents: status === 'ready' ? 'none' : 'auto'
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.3 }}>
          {score} {scoreWord}
          {store.arkanoidBestScore > score ? ` · рекорд ${store.arkanoidBestScore}` : ''}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.86, mt: 0.25 }}>
          {headline || (roundTotal > 0
            ? `Разбито ${broken} из ${roundTotal}. Карточка ломается с трёх попаданий`
            : 'На доске нет карточек')}
        </Typography>
        {status === 'ready' && (
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.78, mt: 0.35 }}>
            Мышь или стрелки двигают каретку. Клик или пробел запускает шарик. Сбиваются карточки на видимой части доски.
          </Typography>
        )}
        {(status === 'lost' || status === 'won') && (
          <Button
            data-arkanoid-ui
            size="small"
            variant="contained"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              store.restartArkanoidRound();
              const sim = simRef.current;
              sim.launched = false;
              sim.vx = 0;
              sim.vy = 0;
              sim.speed = BASE_SPEED;
              sim.contacts.clear();
              sim.targets = new Set();
              setTargetCount(0);
              setGameStatus('ready');
            }}
            sx={{ mt: 1, textTransform: 'none', fontWeight: 800 }}
          >
            Ещё раз
          </Button>
        )}
      </Box>
    </Box>
  );
});

export default ArkanoidGame;
