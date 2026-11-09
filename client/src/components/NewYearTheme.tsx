import React, { useEffect, useState } from 'react';
import {
  NEW_YEAR_THEME_EVENT,
  isNewYearThemeActive
} from './newYearThemePreference';
import './NewYearTheme.css';

interface Props {
  themeMode: 'light' | 'dark';
}

const BULB_COLORS = ['gold', 'red', 'green', 'blue'] as const;

const bulbs = Array.from({ length: 22 }, (_, index) => ({
  x: 18 + index * 58,
  y: 10 + ((index % 5) - 2) * 3,
  color: BULB_COLORS[index % BULB_COLORS.length],
  delay: `${(index % 6) * 0.28}s`
}));

const NewYearTheme: React.FC<Props> = ({ themeMode }) => {
  const [active, setActive] = useState(isNewYearThemeActive);

  useEffect(() => {
    const sync = () => setActive(isNewYearThemeActive());
    window.addEventListener(NEW_YEAR_THEME_EVENT, sync);
    return () => window.removeEventListener(NEW_YEAR_THEME_EVENT, sync);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.ny = '1';
    else delete root.dataset.ny;
    return () => { delete root.dataset.ny; };
  }, [active]);

  if (!active) return null;

  return (
    <div className="new-year-theme" data-theme={themeMode} aria-hidden="true">
      <div className="new-year-theme__glow" />
      <svg className="new-year-theme__garland" viewBox="0 0 1200 42" preserveAspectRatio="none">
        <path
          className="new-year-theme__wire"
          d="M0 18 C 80 4, 160 32, 240 16 S 400 4, 480 20 S 640 34, 720 14 S 880 6, 960 22 S 1120 32, 1200 12"
        />
        {bulbs.map((bulb, index) => (
          <circle
            key={index}
            className={`new-year-theme__bulb new-year-theme__bulb--${bulb.color}`}
            cx={bulb.x}
            cy={Math.max(6, bulb.y - 4)}
            r="3.6"
            style={{ animationDelay: bulb.delay }}
          />
        ))}
      </svg>
    </div>
  );
};

export default NewYearTheme;
