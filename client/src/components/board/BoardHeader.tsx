import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { AppBar, Box, IconButton, Menu, MenuItem, Toolbar, Tooltip, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import SettingsIcon from '@mui/icons-material/Settings';
import { RetroStore } from '../../store/RetroStore';
import { ConnectionStatusLabel, PhaseTimerLabel, PhaseTimerMenuPanel } from '../PhaseTimer';
import MobileBoardHeader from './MobileBoardHeader';
import PhaseSwitcher from './PhaseSwitcher';

interface Props {
  store: RetroStore;
  isMobile: boolean;
  isCompactDesktop: boolean;
  isDarkMode: boolean;
  canUseChat: boolean;
  isChatVisible: boolean;
  mobileTab: number;
  selectedTimerSeconds: number;
  onSelectTimerSeconds: (seconds: number) => void;
  onToggleChat: () => void;
  onTab: (tab: number) => void;
  onOpenSettings: () => void;
  onOpenMusic: () => void;
}

const BoardHeader: React.FC<Props> = observer(({
  store,
  isMobile,
  isCompactDesktop,
  isDarkMode,
  canUseChat,
  isChatVisible,
  mobileTab,
  selectedTimerSeconds,
  onSelectTimerSeconds,
  onToggleChat,
  onTab,
  onOpenSettings,
  onOpenMusic
}) => {
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);
  const [timerAnchorEl, setTimerAnchorEl] = useState<null | HTMLElement>(null);

  const leaveRoomButton = (
    <Tooltip title="Выход из комнаты">
      <IconButton
        color="inherit"
        onClick={() => store.socketService?.leaveRoom()}
        size="small"
        aria-label="Выход из комнаты"
      >
        <ExitToAppIcon />
      </IconButton>
    </Tooltip>
  );

  const timerButton = (
    <Tooltip title="Таймер и музыка">
      <IconButton size="small" onClick={(event) => setTimerAnchorEl(event.currentTarget)}>
        <AccessTimeIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  const timerControls = isCompactDesktop ? null : (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
      <PhaseTimerLabel store={store} prefix="Таймер: " />
      {timerButton}
    </Box>
  );

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: 'background.paper', color: 'text.primary', flexShrink: 0 }}>
      <Toolbar sx={{ gap: 1, flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', minHeight: 64 }}>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, whiteSpace: 'nowrap', lineHeight: 1.2, fontSize: { xs: '1.1rem', md: '1.35rem' } }}
        >
          {isCompactDesktop && !isMobile ? store.room?.id : `Комната: ${store.room?.id}`}
        </Typography>
        <ConnectionStatusLabel store={store} />
        {isCompactDesktop && !isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            <PhaseTimerLabel store={store} />
            {timerButton}
          </Box>
        )}
        <PhaseSwitcher store={store} isMobile={isMobile} isDarkMode={isDarkMode} timerControls={timerControls} />
        {!isCompactDesktop && !isMobile && (
          <>
            <Tooltip title="Настройки">
              <IconButton color="inherit" onClick={onOpenSettings} size="small">
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            {leaveRoomButton}
          </>
        )}
        {!isMobile && isCompactDesktop && (
          <>
            <IconButton size="small" onClick={(event) => setMoreAnchorEl(event.currentTarget)} aria-label="more actions">
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {'>>'}
              </Typography>
            </IconButton>
            <Menu
              anchorEl={moreAnchorEl}
              open={Boolean(moreAnchorEl)}
              onClose={() => setMoreAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={() => { setMoreAnchorEl(null); onOpenSettings(); }}>
                Настройки
              </MenuItem>
            </Menu>
            {leaveRoomButton}
          </>
        )}
        {isMobile ? (
          <MobileBoardHeader
            store={store}
            canUseChat={canUseChat}
            isChatVisible={isChatVisible}
            mobileTab={mobileTab}
            leaveRoomButton={leaveRoomButton}
            onOpenTimer={setTimerAnchorEl}
            onToggleChat={onToggleChat}
            onOpenSettings={onOpenSettings}
            onTab={onTab}
          />
        ) : (
          <Box sx={{ ml: 1 }} />
        )}
        <Menu
          anchorEl={timerAnchorEl}
          open={Boolean(timerAnchorEl)}
          onClose={() => setTimerAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <PhaseTimerMenuPanel
            store={store}
            canPlayTimerMusic={store.roomFeatures.musicEnabled}
            selectedTimerSeconds={selectedTimerSeconds}
            onSelectTimerSeconds={onSelectTimerSeconds}
            onOpenMusic={() => {
              onOpenMusic();
              setTimerAnchorEl(null);
            }}
            onClose={() => setTimerAnchorEl(null)}
          />
        </Menu>
      </Toolbar>
    </AppBar>
  );
});

export default BoardHeader;
