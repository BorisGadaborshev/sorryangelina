import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import './FloorCat.css';
import { FLOOR_CAT_VISIBILITY_EVENT, isFloorCatVisible } from './floorCatPreference';

const CAT_W = 46;
const HEAD_X = 32;
const WALK_SPEED = 22;
const RUN_SPEED = 80;
const FLOOR_BAND = 150;
const NEAR_RADIUS = 100;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const FloorCatActor: React.FC = () => {
  const themeMode = useTheme().palette.mode;
  const actorRef = useRef<HTMLButtonElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const puzzledUntilRef = useRef(0);

  const poke = () => {
    puzzledUntilRef.current = performance.now() + 5600;
  };

  useEffect(() => {
    const actor = actorRef.current;
    const flip = flipRef.current;
    const lift = liftRef.current;
    const cat = catRef.current;
    if (!actor || !flip || !lift || !cat) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = motion.matches;
    const pointer = { x: -9999, y: -9999, active: false };
    let x = Math.min(Math.max(24, window.innerWidth * 0.18), Math.max(4, window.innerWidth - CAT_W - 4));
    let dir = 1;
    let mood: 'walk' | 'sit' | 'sleep' | 'play' = reduce ? 'sleep' : 'walk';
    let goingToBed = false;
    let moodUntil = performance.now() + rand(7000, 13000);
    let last = performance.now();
    let wasSwatting = false;
    let pounceBackAt = 0;
    let raf = 0;

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
      const width = window.innerWidth;
      const height = window.innerHeight;
      const maxX = Math.max(4, width - CAT_W - 4);

      if (puzzledUntilRef.current > now) {
        mood = 'sit';
        goingToBed = false;
      } else if (puzzledUntilRef.current) {
        puzzledUntilRef.current = 0;
        mood = 'walk';
        moodUntil = now + rand(5000, 11000);
      } else if (!reduce) {
        const anchorX = x + CAT_W * 0.62;
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
          if (goingToBed && (x <= 4 || x >= maxX)) {
            x = Math.min(maxX, Math.max(4, x));
            goingToBed = false;
            mood = 'sleep';
            moodUntil = now + rand(5500, 9500);
          } else if (x <= 4) {
            x = 4;
            dir = 1;
          } else if (x >= maxX) {
            x = maxX;
            dir = -1;
          }
        } else if (mood === 'play') {
          const center = x + CAT_W / 2;
          if (Math.abs(pointer.x - center) > 22) {
            dir = pointer.x >= center ? 1 : -1;
          }
          const headOffset = dir === 1 ? HEAD_X : CAT_W - HEAD_X;
          const goal = pointer.x - headOffset - 10 * dir;
          const clamped = Math.min(maxX, Math.max(4, goal));
          const delta = clamped - x;
          const maxStep = RUN_SPEED * dt;
          x += Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
        }
      }

      x = Math.min(maxX, Math.max(4, x));
      const headX = dir === 1 ? x + HEAD_X : x + CAT_W - HEAD_X;
      const shoulderY = height - 16;
      const swatting = mood === 'play'
        && pointer.active
        && Math.abs(pointer.x - headX) < 36
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
        const forward = Math.max(12, (pointer.x - headX) * dir);
        const aim = Math.atan2(pointer.y - shoulderY, forward) * (180 / Math.PI);
        cat.style.setProperty('--aim', `${Math.max(-55, Math.min(24, aim)).toFixed(1)}deg`);
      }

      if (mood === 'play') {
        const eyeX = Math.max(-1, Math.min(1, ((pointer.x - headX) * dir) / 48));
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
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerout', onLeave);
    motion.addEventListener('change', onMotion);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
      motion.removeEventListener('change', onMotion);
    };
  }, []);

  return (
    <div className="floor-cat" data-theme={themeMode}>
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
                  <div className="eye eye-left" />
                  <div className="eye eye-right" />
                </div>
              </div>
            </div>
          </div>
          <div className="floor-cat__zzz" aria-hidden="true">Zzz</div>
          <div className="floor-cat__ask" aria-hidden="true">?</div>
        </div>
      </button>
    </div>
  );
};

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
