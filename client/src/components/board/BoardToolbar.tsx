import React from 'react';
import { observer } from 'mobx-react-lite';
import { Badge, Box, IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import BrushIcon from '@mui/icons-material/Brush';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { RetroStore } from '../../store/RetroStore';

export const WHITEBOARD_COLORS = ['#111111', '#006dff', '#00a878', '#ff6b00', '#e11d48', '#7c3aed'];

const WHITEBOARD_COLOR_LABELS: Record<string, string> = {
  '#111111': 'Чёрный',
  '#006dff': 'Синий',
  '#00a878': 'Зелёный',
  '#ff6b00': 'Оранжевый',
  '#e11d48': 'Красный',
  '#7c3aed': 'Фиолетовый',
};

export type WhiteboardTool = 'pen' | 'eraser';

export const ChatToolbarIcon: React.FC = () => {
  const maskId = React.useId().replace(/:/g, '');
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden
      sx={{ width: 22, height: 22, display: 'block', flexShrink: 0 }}
    >
      <mask id={maskId}>
        <path
          fill="#fff"
          d="M12 3.15c4.78 0 8.4 3.22 8.4 7.12 0 2.55-1.5 4.78-3.74 6.05l.58 2.42a.72.72 0 0 1-1.06.76l-3.34-1.86c-.27.03-.55.05-.84.05-4.78 0-8.4-3.22-8.4-7.42S7.22 3.15 12 3.15Z"
        />
        <circle cx="8.35" cy="10.25" r="1.05" fill="#000" />
        <circle cx="12" cy="10.25" r="1.05" fill="#000" />
        <circle cx="15.65" cy="10.25" r="1.05" fill="#000" />
      </mask>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${maskId})`} />
    </Box>
  );
};

export const ChatToolbarButton: React.FC<{
  active: boolean;
  unread: number;
  onClick: () => void;
}> = ({ active, unread, onClick }) => {
  const hasUnread = unread > 0;
  const label = active ? 'Скрыть чат' : 'Показать чат';
  return (
    <Tooltip title={hasUnread ? `${label} (${unread})` : label}>
      <IconButton
        size="small"
        color="default"
        aria-label={hasUnread ? `${label}, непрочитанных: ${unread}` : label}
        onClick={onClick}
        sx={{ ...chatButtonSx(active), overflow: 'visible' }}
      >
        <Badge
          badgeContent={unread}
          color="error"
          max={99}
          invisible={!hasUnread}
          overlap="circular"
          sx={{
            ...(hasUnread ? {
              animation: 'chatIconShake 0.5s ease-in-out infinite',
              '@keyframes chatIconShake': {
                '0%, 100%': { transform: 'translateX(0)' },
                '25%': { transform: 'translateX(-3px)' },
                '75%': { transform: 'translateX(3px)' },
              },
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
              },
            } : {}),
            '& .MuiBadge-badge': {
              fontSize: 10,
              fontWeight: 700,
              height: 16,
              minWidth: 16,
              padding: '0 4px',
              top: 2,
              right: 0,
            },
          }}
        >
          <ChatToolbarIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export const chatButtonSx = (active: boolean) => ({
  borderRadius: '10px',
  bgcolor: (theme: { palette: { mode: string } }) => (
    active
      ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(20, 24, 40, 0.06)')
      : 'transparent'
  ),
  '&:hover': {
    bgcolor: (theme: { palette: { mode: string; action: { hover: string } } }) => (
      active
        ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(20, 24, 40, 0.1)')
        : theme.palette.action.hover
    ),
  },
});

interface Props {
  store: RetroStore;
  canUseChat: boolean;
  canDraw: boolean;
  canPlayArkanoid: boolean;
  isChatVisible: boolean;
  isDrawEnabled: boolean;
  isArkanoidEnabled: boolean;
  tool: WhiteboardTool;
  color: string;
  onToggleChat: () => void;
  onToggleDraw: () => void;
  onToggleArkanoid: () => void;
  onTool: (tool: WhiteboardTool) => void;
  onColor: (color: string) => void;
}

const ToolGlyph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: 20, height: 20, display: 'block' }}>
    {children}
  </Box>
);

const PenIcon = () => (
  <ToolGlyph>
    <path
      fill="currentColor"
      d="M3.2 17.1V20.8h3.7L18.2 9.5l-3.7-3.7L3.2 17.1zm15.9-10.5 1.5-1.5a1.3 1.3 0 0 0 0-1.8l-1.9-1.9a1.3 1.3 0 0 0-1.8 0l-1.5 1.5 3.7 3.7z"
    />
  </ToolGlyph>
);

const EraserIcon = () => (
  <ToolGlyph>
    <path
      fill="currentColor"
      d="M15.6 3.7a1.8 1.8 0 0 1 2.5 0l2.2 2.2a1.8 1.8 0 0 1 0 2.5L11.2 17.5l-4.7-4.7 9.1-9.1zM5.4 13.9l4.7 4.7-1.2 1.1a1.5 1.5 0 0 1-1.1.5H4.4a1 1 0 0 1-1-1.1l.4-2.8c.1-.5.3-.9.7-1.2l.9-1.2z"
    />
  </ToolGlyph>
);

const ClearIcon = () => (
  <ToolGlyph>
    <path
      fill="currentColor"
      d="M9 3.2h6c.4 0 .8.3.9.7l.3 1.3H20v2H4v-2h3.8l.3-1.3c.1-.4.5-.7.9-.7zM6.2 8.5h11.6l-.7 10.4a1.8 1.8 0 0 1-1.8 1.7H8.7a1.8 1.8 0 0 1-1.8-1.7L6.2 8.5z"
    />
  </ToolGlyph>
);

const BoardToolbar: React.FC<Props> = observer(({
  store,
  canUseChat,
  canDraw,
  canPlayArkanoid,
  isChatVisible,
  isDrawEnabled,
  isArkanoidEnabled,
  tool,
  color,
  onToggleChat,
  onToggleDraw,
  onToggleArkanoid,
  onTool,
  onColor
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const toolButtonSx = (active: boolean) => ({
    width: 30,
    height: 30,
    borderRadius: '8px',
    color: 'text.primary',
    bgcolor: active
      ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20, 24, 40, 0.08)')
      : 'transparent',
    '&:hover': {
      bgcolor: active
        ? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(20, 24, 40, 0.12)')
        : 'action.hover',
    },
  });

  return (
  <Box sx={{ px: 0.75, py: 0.75, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
      {canUseChat && (
        <ChatToolbarButton
          active={isChatVisible}
          unread={store.unreadChatCount}
          onClick={onToggleChat}
        />
      )}
      {canDraw && (
        <Tooltip title={isDrawEnabled ? 'Выключить рисование' : 'Включить рисование'}>
          <IconButton
            size="small"
            color="default"
            aria-label={isDrawEnabled ? 'Выключить рисование' : 'Включить рисование'}
            aria-pressed={isDrawEnabled}
            onClick={onToggleDraw}
            sx={chatButtonSx(isDrawEnabled)}
          >
            <BrushIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      )}
      {canPlayArkanoid && (
        <Tooltip title={isArkanoidEnabled ? 'Выйти из Arkanoid' : 'Запустить Arkanoid'}>
          <IconButton
            size="small"
            color={isArkanoidEnabled ? 'primary' : 'default'}
            aria-label={isArkanoidEnabled ? 'Выйти из Arkanoid' : 'Запустить Arkanoid'}
            onClick={onToggleArkanoid}
          >
            <SportsEsportsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
    {canDraw && isDrawEnabled && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, width: '100%', minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 0.25,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20, 24, 40, 0.04)',
              flexShrink: 0,
            }}
          >
            <Tooltip title="Перо">
              <IconButton size="small" aria-label="Перо" aria-pressed={tool === 'pen'} onClick={() => onTool('pen')} sx={toolButtonSx(tool === 'pen')}>
                <PenIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Ластик">
              <IconButton size="small" aria-label="Ластик" aria-pressed={tool === 'eraser'} onClick={() => onTool('eraser')} sx={toolButtonSx(tool === 'eraser')}>
                <EraserIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
            {WHITEBOARD_COLORS.map((item) => {
              const selected = color === item && tool === 'pen';
              return (
                <Tooltip key={item} title={WHITEBOARD_COLOR_LABELS[item] || 'Цвет'}>
                  <Box
                    component="button"
                    type="button"
                    aria-label={WHITEBOARD_COLOR_LABELS[item] || 'Цвет'}
                    aria-pressed={selected}
                    onClick={() => {
                      onColor(item);
                      onTool('pen');
                    }}
                    sx={{
                      width: 22,
                      height: 22,
                      p: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 0,
                      borderRadius: '50%',
                      bgcolor: 'transparent',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        bgcolor: item,
                        border: '1px solid',
                        borderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)',
                        boxShadow: selected
                          ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 3.5px ${isDark ? 'rgba(255,255,255,0.92)' : 'rgba(20,24,40,0.82)'}`
                          : 'none',
                      }}
                    />
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
          <Tooltip title="Очистить">
            <IconButton
              size="small"
              aria-label="Очистить"
              onClick={() => {
                store.clearWhiteboard();
                store.socketService?.clearWhiteboard();
              }}
              sx={toolButtonSx(false)}
            >
              <ClearIcon />
            </IconButton>
          </Tooltip>
        </Box>
    )}
  </Box>
  );
});

export default BoardToolbar;
