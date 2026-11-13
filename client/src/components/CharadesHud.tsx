import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Chip, Paper, Typography } from '@mui/material';
import { RetroStore } from '../store/RetroStore';

interface Props {
  store: RetroStore;
}

const CharadesHud: React.FC<Props> = observer(({ store }) => {
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
  } else if (game.status === 'guessed') {
    title = `${game.winnerName || 'Кто-то'} угадал: ${game.lastWord || ''}`;
    detail = 'Следующий раунд начнётся через пару секунд.';
  }

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.5,
        py: 1.1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 8px 24px rgba(20, 24, 40, 0.12)',
        pointerEvents: 'none'
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
        {detail}
      </Typography>
      {scores.reduce((sum, entry) => sum + entry.score, 0) > 0 && (
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
      <Typography variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
        Чтобы закончить игру, перейдите на этап «Создание».
      </Typography>
    </Paper>
  );
});

export default CharadesHud;
