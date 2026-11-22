import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Chip, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { RetroStore } from '../store/RetroStore';

interface Props {
  store: RetroStore;
  compact?: boolean;
  layout?: 'card' | 'bar';
  onExpand?: () => void;
}

const CharadesHud: React.FC<Props> = observer(({ store, compact = false, layout = 'card', onExpand }) => {
  const game = store.charades;
  const myName = store.currentUser?.name;
  const isDrawer = Boolean(myName && game.drawerName === myName);
  const scores = game.scores.filter((entry) => entry.score > 0).slice(0, 6);

  let title = 'Шарады';
  let detail = 'Ждём игроков. Нужно минимум двое.';
  if (game.status === 'playing' && isDrawer) {
    title = `Ты рисуешь: ${game.word || '…'}`;
    detail = 'Нарисуй или намекни в чате. Само слово писать нельзя.';
  } else if (game.status === 'playing' && game.drawerName) {
    title = `Рисует ${game.drawerName}`;
    detail = 'Пиши ответ в чате. Первый правильный получает очко.';
  } else if (game.status === 'guessed' && game.winnerName) {
    title = `${game.winnerName} угадал: ${game.lastWord || ''}`;
    detail = 'Следующий раунд начнётся через пару секунд.';
  } else if (game.status === 'guessed') {
    title = `Слово: ${game.lastWord || ''}`;
    detail = 'Никто не угадал. Следующий раунд начнётся через пару секунд.';
  }

  const canRevealWord = game.status === 'playing' && isDrawer && Boolean(game.word);

  if (layout === 'bar') {
    return (
      <Paper
        elevation={0}
        sx={{
          px: 1.25,
          py: 0.6,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: '0 8px 24px rgba(20, 24, 40, 0.12)',
          pointerEvents: 'none'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 800, flexGrow: 1, minWidth: 0 }}>
            {title}
          </Typography>
          {canRevealWord && (
            <Tooltip title="Показать слово">
              <IconButton
                size="small"
                aria-label="Показать слово"
                onClick={() => store.socketService?.revealCharadesWord()}
                sx={{ pointerEvents: 'auto', color: 'text.secondary' }}
              >
                <VisibilityOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onExpand && (
            <Tooltip title="Рисовать на весь экран">
              <IconButton
                size="small"
                aria-label="Рисовать на весь экран"
                onClick={onExpand}
                sx={{ pointerEvents: 'auto' }}
              >
                <OpenInFullIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        px: compact ? 1.25 : 1.5,
        py: compact ? 0.75 : 1.1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 8px 24px rgba(20, 24, 40, 0.12)',
        pointerEvents: 'none'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {detail}
          </Typography>
        </Box>
        {canRevealWord && (
          <Tooltip title="Показать слово">
            <IconButton
              size="small"
              aria-label="Показать слово"
              onClick={() => store.socketService?.revealCharadesWord()}
              sx={{ pointerEvents: 'auto', mt: -0.25, color: 'text.secondary' }}
            >
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {!compact && scores.reduce((sum, entry) => sum + entry.score, 0) > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          С каждым угаданным словом задания становятся сложнее: вещи, затем явления, затем эмоции.
        </Typography>
      )}
      {scores.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1 }}>
          {scores.map((entry) => (
            <Chip
              key={entry.userName}
              size="small"
              label={`${entry.userName} · ${entry.score}`}
              color={entry.userName === game.winnerName ? 'primary' : 'default'}
            />
          ))}
        </Box>
      )}
      <Typography variant={compact ? 'caption' : 'body2'} sx={{ mt: compact ? 0.5 : 1, fontWeight: 700, display: 'block' }}>
        Чтобы закончить игру, перейдите на этап «Создание».
      </Typography>
    </Paper>
  );
});

export default CharadesHud;
