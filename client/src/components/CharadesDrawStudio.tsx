import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Dialog, IconButton, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { RetroStore } from '../store/RetroStore';
import CharadesHud from './CharadesHud';
import ChatTerminal from './ChatTerminal';
import CollaborativeWhiteboard from './CollaborativeWhiteboard';
import BoardToolbar, { WhiteboardTool } from './board/BoardToolbar';

const DRAWING_SHEET = '#fffdf8';

interface Props {
  open: boolean;
  store: RetroStore;
  tool: WhiteboardTool;
  color: string;
  onClose: () => void;
  onTool: (tool: WhiteboardTool) => void;
  onColor: (color: string) => void;
}

const CharadesDrawStudio: React.FC<Props> = observer(({
  open,
  store,
  tool,
  color,
  onClose,
  onTool,
  onColor
}) => {
  const isDrawer = Boolean(store.currentUser?.name && store.charades.drawerName === store.currentUser.name);
  const isDrawerRef = useRef(isDrawer);
  isDrawerRef.current = isDrawer;
  const [messagesOpen, setMessagesOpen] = useState(true);
  const [frame, setFrame] = useState({ offsetTop: 0, height: 0 });

  useEffect(() => {
    if (!open) return;
    setMessagesOpen(!isDrawerRef.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      setFrame({ offsetTop: viewport.offsetTop, height: viewport.height });
    };
    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
    };
  }, [open]);

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      disableAutoFocus
      aria-label="Холст шарад"
      PaperProps={{
        sx: {
          position: 'fixed',
          top: frame.height ? `${frame.offsetTop}px` : 0,
          left: 0,
          right: 0,
          height: frame.height ? `${frame.height}px` : '100dvh',
          maxHeight: frame.height ? `${frame.height}px` : '100dvh',
          m: 0,
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.paper'
        }
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          pt: 'env(safe-area-inset-top)',
          pb: 'env(safe-area-inset-bottom)',
          overscrollBehavior: 'none'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75, flexShrink: 0 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <CharadesHud store={store} layout="bar" />
          </Box>
          <Tooltip title={messagesOpen ? 'Скрыть сообщения' : 'Показать сообщения'}>
            <IconButton
              size="small"
              aria-label={messagesOpen ? 'Скрыть сообщения' : 'Показать сообщения'}
              aria-pressed={messagesOpen}
              onClick={() => setMessagesOpen((prev) => !prev)}
            >
              <ChatBubbleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="К доске">
            <IconButton size="small" aria-label="Закрыть холст" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pb: 0.75, flexShrink: 0 }}>
          Закройте холст, чтобы сменить этап. Игра заканчивается на этапе «Создание».
        </Typography>
        <Box sx={{ flex: 1, minHeight: 0, position: 'relative', bgcolor: DRAWING_SHEET, touchAction: 'none' }}>
          <CollaborativeWhiteboard store={store} enabled tool={tool} color={color} />
        </Box>
        <BoardToolbar
          store={store}
          canUseChat={false}
          canDraw
          canPlayArkanoid={false}
          canPlayCatRun={false}
          isChatVisible={false}
          isDrawEnabled
          isArkanoidEnabled={false}
          isCatRunEnabled={false}
          tool={tool}
          color={color}
          showChat={false}
          toolsOnly
          onToggleChat={() => undefined}
          onToggleDraw={() => undefined}
          onToggleArkanoid={() => undefined}
          onToggleCatRun={() => undefined}
          onTool={onTool}
          onColor={onColor}
        />
        <Box sx={{ flexShrink: 0, px: 1, pb: 1 }}>
          <ChatTerminal
            store={store}
            compact
            height={messagesOpen ? 148 : undefined}
            showMessages={messagesOpen}
            placeholder="Догадка..."
          />
        </Box>
      </Box>
    </Dialog>
  );
});

export default CharadesDrawStudio;
