import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import BrushIcon from '@mui/icons-material/Brush';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { RetroStore } from '../../store/RetroStore';
import JoystickIcon from '../JoystickIcon';

export const WHITEBOARD_COLORS = ['#111111', '#006dff', '#00a878', '#ff6b00', '#e11d48', '#7c3aed'];

export type WhiteboardTool = 'pen' | 'eraser';

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
}) => (
  <Box sx={{ p: 0.75, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
      {canUseChat && (
        <Tooltip title={isChatVisible ? 'Скрыть чат' : 'Показать чат'}>
          <IconButton size="small" color={isChatVisible ? 'primary' : 'default'} onClick={onToggleChat}>
            <ChatBubbleOutlineIcon />
          </IconButton>
        </Tooltip>
      )}
      {canDraw && (
        <Tooltip title={isDrawEnabled ? 'Выключить рисование' : 'Включить рисование'}>
          <IconButton size="small" color={isDrawEnabled ? 'primary' : 'default'} onClick={onToggleDraw}>
            <BrushIcon fontSize="small" />
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
            <JoystickIcon />
          </IconButton>
        </Tooltip>
      )}
      {canDraw && isDrawEnabled && (
        <>
          <Tooltip title="Перо">
            <IconButton size="small" color={tool === 'pen' ? 'primary' : 'default'} onClick={() => onTool('pen')}>
              <BrushIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Ластик">
            <IconButton size="small" color={tool === 'eraser' ? 'primary' : 'default'} onClick={() => onTool('eraser')}>
              <CleaningServicesIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {WHITEBOARD_COLORS.map((item) => (
            <Button
              key={item}
              onClick={() => {
                onColor(item);
                onTool('pen');
              }}
              sx={{
                minWidth: 16,
                width: 16,
                height: 16,
                p: 0,
                borderRadius: '50%',
                bgcolor: item,
                border: color === item && tool === 'pen' ? '2px solid #111' : '1px solid rgba(0,0,0,0.2)'
              }}
            />
          ))}
          <Tooltip title="Очистить">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                store.clearWhiteboard();
                store.socketService?.clearWhiteboard();
              }}
            >
              <DeleteSweepIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  </Box>
));

export default BoardToolbar;
