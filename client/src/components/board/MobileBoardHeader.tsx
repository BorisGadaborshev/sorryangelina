import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, IconButton, Tab, Tabs, Tooltip } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ChatToolbarButton } from './BoardToolbar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SettingsIcon from '@mui/icons-material/Settings';
import { RetroStore } from '../../store/RetroStore';
import { getReadyButtonSx } from '../readyButtonStyles';

interface Props {
  store: RetroStore;
  canUseChat: boolean;
  isChatVisible: boolean;
  mobileTab: number;
  leaveRoomButton: React.ReactNode;
  onOpenTimer: (anchor: HTMLElement) => void;
  onToggleChat: () => void;
  onOpenSettings: () => void;
  onTab: (tab: number) => void;
}

const MobileBoardHeader: React.FC<Props> = observer(({
  store,
  canUseChat,
  isChatVisible,
  mobileTab,
  leaveRoomButton,
  onOpenTimer,
  onToggleChat,
  onOpenSettings,
  onTab
}) => {
  const readyEnabled = store.roomFeatures.readyEnabled;
  const currentUser = store.currentUser;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5, gap: 0.5 }}>
        <Tooltip title="Таймер и музыка">
          <IconButton color="inherit" onClick={(event) => onOpenTimer(event.currentTarget)} size="small">
            <AccessTimeIcon />
          </IconButton>
        </Tooltip>
        {canUseChat && (
          <ChatToolbarButton
            active={isChatVisible}
            unread={store.unreadChatCount}
            onClick={onToggleChat}
          />
        )}
        <Tooltip title="Настройки">
          <IconButton color="inherit" onClick={onOpenSettings} size="small">
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        {leaveRoomButton}
      </Box>
      {readyEnabled && currentUser && (
        <Button
          variant="contained"
          fullWidth
          size="small"
          onClick={() => store.updateUserReadyState(!currentUser.isReady)}
          startIcon={currentUser.isReady ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
          sx={{ ...getReadyButtonSx(Boolean(currentUser.isReady)), mb: 0.5 }}
        >
          {currentUser.isReady ? 'Я готов(а)' : 'Отметить готовность'}
        </Button>
      )}
      <Tabs value={mobileTab} onChange={(_, value) => onTab(value)} textColor="inherit" indicatorColor="secondary" sx={{ width: '100%' }}>
        <Tab label="Доска" />
        <Tab
          label={
            readyEnabled ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                Участники (
                ✅ {store.getUserReadyCount()}
                {' / '}
                <PersonIcon sx={{ fontSize: 16 }} />
                {store.users.length})
              </Box>
            ) : `Участники (${store.users.length})`
          }
        />
      </Tabs>
    </Box>
  );
});

export default MobileBoardHeader;
