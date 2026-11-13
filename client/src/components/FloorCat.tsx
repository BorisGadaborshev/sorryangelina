import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTheme } from '@mui/material/styles';
import './FloorCat.css';
import { FLOOR_CAT_VISIBILITY_EVENT, isFloorCatVisible } from './floorCatPreference';
import {
  BOARD_WEATHER_KIND_EVENT,
  readActiveBoardWeatherKind
} from './boardWeatherPreference';
import {
  NEW_YEAR_THEME_EVENT,
  isNewYearThemeActive
} from './newYearThemePreference';
import { useRetroStore } from '../store/StoreContext';
import { isFemininePersonName } from '../utils/feminineName';

const CAT_W = 46;
const HEAD_X = 32;
const WALK_SPEED = 22;
const RUN_SPEED = 80;
const FLOOR_BAND = 150;
const NEAR_RADIUS = 100;
const EDGE_PAD = 8;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const boardWalkLane = () => {
  const board = document.querySelector('[data-cat-run-board]');
  if (!(board instanceof HTMLElement)) {
    const width = window.innerWidth;
    return {
      left: 0,
      width,
      bottom: 0,
      minX: EDGE_PAD,
      maxX: Math.max(EDGE_PAD, width - CAT_W - EDGE_PAD)
    };
  }
  const rect = board.getBoundingClientRect();
  const width = Math.max(CAT_W + EDGE_PAD * 2, rect.width);
  return {
    left: rect.left,
    width,
    bottom: Math.max(0, window.innerHeight - rect.bottom),
    minX: EDGE_PAD,
    maxX: Math.max(EDGE_PAD, width - CAT_W - EDGE_PAD)
  };
};

const FloorCatActor: React.FC = observer(() => {
  const themeMode = useTheme().palette.mode;
  const store = useRetroStore();
  const withBow = isFemininePersonName(store.currentUser?.name || store.authProfile?.name);
  const rootRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLButtonElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const printsRef = useRef<HTMLCanvasElement>(null);
  const puzzledUntilRef = useRef(0);
  const snowingRef = useRef(readActiveBoardWeatherKind() === 'snow');
  const [snowing, setSnowing] = useState(() => snowingRef.current);
  const [festive, setFestive] = useState(isNewYearThemeActive);

  useEffect(() => {
    const sync = () => {
      const next = readActiveBoardWeatherKind() === 'snow';
      snowingRef.current = next;
      setSnowing(next);
    };
    window.addEventListener(BOARD_WEATHER_KIND_EVENT, sync);
    return () => window.removeEventListener(BOARD_WEATHER_KIND_EVENT, sync);
  }, []);

  useEffect(() => {
    const sync = () => setFestive(isNewYearThemeActive());
    window.addEventListener(NEW_YEAR_THEME_EVENT, sync);
    return () => window.removeEventListener(NEW_YEAR_THEME_EVENT, sync);
  }, []);

  const poke = () => {
    puzzledUntilRef.current = performance.now() + 5600;
  };

  useEffect(() => {
    const root = rootRef.current;
    const actor = actorRef.current;
    const flip = flipRef.current;
    const lift = liftRef.current;
    const cat = catRef.current;
    const prints = printsRef.current;
    if (!root || !actor || !flip || !lift || !cat) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = motion.matches;
    const pointer = { x: -9999, y: -9999, active: false };
    let lane = boardWalkLane();
    const applyLane = () => {
      lane = boardWalkLane();
      root.style.left = `${lane.left}px`;
      root.style.width = `${lane.width}px`;
      root.style.right = 'auto';
      root.style.bottom = `${lane.bottom}px`;
    };
    applyLane();
    let x = Math.min(Math.max(lane.minX, lane.width * 0.18), lane.maxX);
    let dir = 1;
    let mood: 'walk' | 'sit' | 'sleep' | 'play' = reduce ? 'sleep' : 'walk';
    let goingToBed = false;
    let moodUntil = performance.now() + rand(7000, 13000);
    let last = performance.now();
    let wasSwatting = false;
    let pounceBackAt = 0;
    let raf = 0;
    let lastPrintX = -999;
    const pawPrints: Array<{ x: number; y: number; dir: number; at: number }> = [];

    const sizePrints = () => {
      if (!prints) return;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, lane.width);
      prints.width = Math.floor(width * ratio);
      prints.height = Math.floor(18 * ratio);
      prints.style.width = `${width}px`;
      prints.style.height = '18px';
    };
    sizePrints();

    const drawPrints = (now: number) => {
      if (!prints) return;
      const ctx = prints.getContext('2d');
      if (!ctx) return;
      const ratio = window.devicePixelRatio || 1;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, prints.width, prints.height);
      const live = pawPrints.filter((print) => now - print.at < 14000);
      pawPrints.length = 0;
      pawPrints.push(...live);
      for (const print of live) {
        const age = (now - print.at) / 14000;
        ctx.save();
        ctx.translate(print.x, print.y);
        ctx.rotate(print.dir < 0 ? -0.35 : 0.35);
        ctx.fillStyle = `rgba(90, 104, 128, ${0.28 * (1 - age)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.4, 2.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-2.2 * print.dir, -2.4, 1.3, 1.1, 0, 0, Math.PI * 2);
        ctx.ellipse(0.2 * print.dir, -2.8, 1.2, 1.05, 0, 0, Math.PI * 2);
        ctx.ellipse(2.4 * print.dir, -2.3, 1.2, 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };
    const onLeave = (event: PointerEvent) => {
      if (!event.relatedTarget) pointer.active = false;
    };
    const onMotion = () => {
      reduce = motion.matches;
      if (reduce) mood = 'sleep';
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) {
        last = now;
        return;
      }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      applyLane();
      if (prints && Math.abs(prints.clientWidth - lane.width) > 1) sizePrints();
      const width = lane.width;
      const minX = lane.minX;
      const maxX = lane.maxX;
      const height = window.innerHeight - lane.bottom;

      if (puzzledUntilRef.current > now) {
        mood = 'sit';
        goingToBed = false;
      } else if (puzzledUntilRef.current) {
        puzzledUntilRef.current = 0;
        mood = 'walk';
        moodUntil = now + rand(5000, 11000);
      } else if (!reduce) {
        const anchorX = lane.left + x + CAT_W * 0.62;
        const dist = Math.hypot(pointer.x - anchorX, pointer.y - (height - 28));
        const wantsPlay = pointer.active && (pointer.y >= height - FLOOR_BAND || dist < NEAR_RADIUS);

        if (wantsPlay) {
          mood = 'play';
          goingToBed = false;
          moodUntil = now + 900;
        } else if (mood === 'play' && now >= moodUntil) {
          mood = 'walk';
          moodUntil = now + rand(6000, 12000);
        } else if (mood === 'walk' && !goingToBed && now >= moodUntil) {
          if (Math.random() < 0.6) {
            mood = 'sit';
            moodUntil = now + rand(2500, 5000);
          } else {
            goingToBed = true;
            dir = x + CAT_W / 2 < width / 2 ? -1 : 1;
          }
        } else if (mood === 'sit' && now >= moodUntil) {
          mood = 'walk';
          moodUntil = now + rand(5000, 11000);
        } else if (mood === 'sleep' && now >= moodUntil) {
          mood = 'walk';
          dir = Math.random() < 0.5 ? -1 : 1;
          moodUntil = now + rand(8000, 15000);
        }

        if (mood === 'walk') {
          x += dir * WALK_SPEED * dt;
          if (goingToBed && (x <= minX || x >= maxX)) {
            x = Math.min(maxX, Math.max(minX, x));
            goingToBed = false;
            mood = 'sleep';
            moodUntil = now + rand(5500, 9500);
          } else if (x <= minX) {
            x = minX;
            dir = 1;
          } else if (x >= maxX) {
            x = maxX;
            dir = -1;
          }
        } else if (mood === 'play') {
          const localPointerX = pointer.x - lane.left;
          const center = x + CAT_W / 2;
          if (Math.abs(localPointerX - center) > 22) {
            dir = localPointerX >= center ? 1 : -1;
          }
          const headOffset = dir === 1 ? HEAD_X : CAT_W - HEAD_X;
          const goal = localPointerX - headOffset - 10 * dir;
          const clamped = Math.min(maxX, Math.max(minX, goal));
          const delta = clamped - x;
          const maxStep = RUN_SPEED * dt;
          x += Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
        }
      }

      x = Math.min(maxX, Math.max(minX, x));
      const headX = dir === 1 ? x + HEAD_X : x + CAT_W - HEAD_X;
      const headScreenX = lane.left + headX;
      const shoulderY = height - 16;
      const swatting = mood === 'play'
        && pointer.active
        && Math.abs(pointer.x - headScreenX) < 36
        && pointer.y > height - 180;

      if (swatting && !wasSwatting) {
        lift.style.transform = 'translateY(-4px)';
        pounceBackAt = now + 160;
      } else if (pounceBackAt && now >= pounceBackAt) {
        lift.style.transform = 'translateY(0)';
        pounceBackAt = 0;
      }
      wasSwatting = swatting;

      if (swatting) {
        const forward = Math.max(12, (pointer.x - headScreenX) * dir);
        const aim = Math.atan2(pointer.y - shoulderY, forward) * (180 / Math.PI);
        cat.style.setProperty('--aim', `${Math.max(-55, Math.min(24, aim)).toFixed(1)}deg`);
      }

      if (mood === 'play') {
        const eyeX = Math.max(-1, Math.min(1, ((pointer.x - headScreenX) * dir) / 48));
        const eyeY = Math.max(-0.6, Math.min(0.6, (pointer.y - (height - 24)) / 70));
        cat.style.setProperty('--eye-x', `${eyeX.toFixed(2)}px`);
        cat.style.setProperty('--eye-y', `${eyeY.toFixed(2)}px`);
      } else {
        cat.style.setProperty('--eye-x', '0px');
        cat.style.setProperty('--eye-y', '0px');
      }

      const ask = puzzledUntilRef.current > now ? '1' : '';
      if (cat.dataset.ask !== ask) cat.dataset.ask = ask;
      actor.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      flip.style.setProperty('--face', dir < 0 ? '-1' : '1');
      if (cat.dataset.mood !== mood) cat.dataset.mood = mood;
      const action = swatting ? 'swat' : '';
      if (cat.dataset.action !== action) cat.dataset.action = action;
      const look = mood === 'play' && pointer.y < height - 48 ? 'up' : 'ahead';
      if (cat.dataset.look !== look) cat.dataset.look = look;

      if (snowingRef.current && (mood === 'walk' || mood === 'play') && Math.abs(x - lastPrintX) > 11) {
        const hind = dir === 1 ? x + 14 : x + 30;
        const front = dir === 1 ? x + 27 : x + 18;
        pawPrints.push({ x: hind, y: 12, dir, at: now });
        pawPrints.push({ x: front, y: 11, dir, at: now });
        lastPrintX = x;
      }
      if (!snowingRef.current && pawPrints.length) {
        pawPrints.length = 0;
        lastPrintX = -999;
      }
      drawPrints(now);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerout', onLeave);
    const onResize = () => {
      applyLane();
      sizePrints();
      x = Math.min(maxXFromLane(), Math.max(lane.minX, x));
    };
    const maxXFromLane = () => lane.maxX;
    window.addEventListener('resize', onResize);
    motion.addEventListener('change', onMotion);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
      window.removeEventListener('resize', onResize);
      motion.removeEventListener('change', onMotion);
    };
  }, []);

  return (
    <div ref={rootRef} className="floor-cat" data-theme={themeMode} data-bow={withBow ? '1' : '0'} data-snow={snowing ? '1' : '0'} data-ny={festive ? '1' : '0'}>
      <canvas className="floor-cat__snow-prints" ref={printsRef} aria-hidden="true" />
      {festive ? (
        <svg className="floor-cat__tree" viewBox="0 0 80 100" aria-hidden="true">
          <ellipse className="floor-cat__tree-base" cx="40" cy="94" rx="22" ry="5" />
          <rect className="floor-cat__tree-trunk" x="36" y="78" width="8" height="16" rx="1.2" />
          <path className="floor-cat__tree-layer floor-cat__tree-layer--back" d="M40 42 L76 80 H4 Z" />
          <path className="floor-cat__tree-layer" d="M40 26 L68 60 H12 Z" />
          <path className="floor-cat__tree-layer floor-cat__tree-layer--lit" d="M40 12 L58 40 H22 Z" />
          <polygon className="floor-cat__tree-star" points="40,2 42.2,8.4 49,8.6 43.6,12.6 45.6,19 40,15.4 34.4,19 36.4,12.6 31,8.6 37.8,8.4" />
          <circle className="floor-cat__tree-bauble floor-cat__tree-bauble--red" cx="32" cy="36" r="2.1" />
          <circle className="floor-cat__tree-bauble floor-cat__tree-bauble--gold" cx="48" cy="38" r="2" />
          <circle className="floor-cat__tree-bauble floor-cat__tree-bauble--blue" cx="28" cy="54" r="2.2" />
          <circle className="floor-cat__tree-bauble floor-cat__tree-bauble--gold" cx="52" cy="56" r="2.1" />
          <circle className="floor-cat__tree-bauble floor-cat__tree-bauble--red" cx="38" cy="68" r="2.2" />
          <circle className="floor-cat__tree-bauble floor-cat__tree-bauble--blue" cx="58" cy="70" r="2" />
        </svg>
      ) : null}
      <button type="button" className="floor-cat__actor" ref={actorRef} aria-label="Котик" onClick={poke}>
        <div className="floor-cat__flip" ref={flipRef}>
          <div className="floor-cat__lift" ref={liftRef}>
            <div className="cat" ref={catRef} data-mood="walk">
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
                  <div className="snow-hat" aria-hidden="true" />
                  <div className="ny-hat" aria-hidden="true" />
                  <div className="bow" aria-hidden="true" />
                  <div className="eye eye-left" />
                  <div className="eye eye-right" />
                </div>
              </div>
            </div>
          </div>
          <div className="floor-cat__zzz" aria-hidden="true">Zzz</div>
        </div>
        <div className="floor-cat__ask" aria-hidden="true">мяу...м..гав-гав?</div>
      </button>
    </div>
  );
});

const FloorCat: React.FC = () => {
  const [shown, setShown] = useState(isFloorCatVisible);

  useEffect(() => {
    const sync = () => setShown(isFloorCatVisible());
    window.addEventListener(FLOOR_CAT_VISIBILITY_EVENT, sync);
    return () => window.removeEventListener(FLOOR_CAT_VISIBILITY_EVENT, sync);
  }, []);

  if (!shown) return null;
  return <FloorCatActor />;
};

export default FloorCat;
