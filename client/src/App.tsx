import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import { RetroStore } from './store/RetroStore';
import { RetroStoreProvider } from './store/StoreContext';
import { observer } from 'mobx-react-lite';
import ErrorBoundary from './components/ErrorBoundary';
import FloorCat from './components/FloorCat';

const Login = lazy(() => import('./components/Login'));
const Board = lazy(() => import('./components/Board'));

type ThemePreference = 'system' | 'light' | 'dark';
type ThemeMode = 'light' | 'dark';
const THEME_PREF_KEY = 'themePreference';

const App = observer(() => {
  const [store] = useState(() => new RetroStore());
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(THEME_PREF_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const themeMode: ThemeMode = themePreference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themePreference;

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: {
            main: '#1976d2'
          },
          secondary: {
            main: '#9c27b0'
          }
        },
        typography: {
          fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
        }
      }),
    [themeMode]
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_PREF_KEY, themePreference);
  }, [themePreference]);

  const handleToggleTheme = () => {
    setThemePreference((prev) => {
      const resolvedCurrent = prev === 'system' ? (systemPrefersDark ? 'dark' : 'light') : prev;
      return resolvedCurrent === 'dark' ? 'light' : 'dark';
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary title="Приложение не удалось показать">
        <RetroStoreProvider store={store}>
          <Suspense fallback={(
            <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}>
            {store.hasBoardSession ? (
              <Board store={store} themeMode={themeMode} onToggleTheme={handleToggleTheme} />
            ) : (
              <Login store={store} />
            )}
          </Suspense>
        </RetroStoreProvider>
      </ErrorBoundary>
      <FloorCat />
    </ThemeProvider>
  );
});

export default App;
