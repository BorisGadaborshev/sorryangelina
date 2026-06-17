import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, LinearProgress, Paper, Radio, Step, StepLabel, Stepper, Typography, useTheme } from '@mui/material';
import { RetroStore } from '../store/RetroStore';

interface Props {
  store: RetroStore;
}

type RatingOption = {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  bgcolor: string;
  color: string;
  barColor: string;
};

const LIGHT_RATING_OPTIONS: RatingOption[] = [
  { value: 1, label: 'Определенно не стоит нашего времени', bgcolor: '#f8fafc', color: '#1a1a1a', barColor: '#94a3b8' },
  { value: 2, label: 'Вероятно, не стоит нашего времени', bgcolor: '#e4e7ef', color: '#1a1a1a', barColor: '#a8b0c2' },
  { value: 3, label: 'Стоит нашего времени', bgcolor: '#9be7c6', color: '#0f3d2e', barColor: '#5fd6a4' },
  { value: 4, label: 'Хорошее использование нашего времени', bgcolor: '#12d28a', color: '#06251a', barColor: '#12d28a' },
  { value: 5, label: 'Отличное использование нашего времени', bgcolor: '#07bf72', color: '#06251a', barColor: '#07bf72' }
];

const DARK_RATING_OPTIONS: RatingOption[] = [
  { value: 1, label: 'Определенно не стоит нашего времени', bgcolor: '#6b3a3a', color: '#ffe8e8', barColor: '#c97a7a' },
  { value: 2, label: 'Вероятно, не стоит нашего времени', bgcolor: '#5a4f45', color: '#f5ebe2', barColor: '#b39a84' },
  { value: 3, label: 'Стоит нашего времени', bgcolor: '#2f6b56', color: '#dff9ee', barColor: '#5fd6a4' },
  { value: 4, label: 'Хорошее использование нашего времени', bgcolor: '#1f8a62', color: '#e8fff5', barColor: '#2ecf92' },
  { value: 5, label: 'Отличное использование нашего времени', bgcolor: '#12a86e', color: '#f0fff8', barColor: '#07bf72' }
];

const RetroRatingView: React.FC<Props> = observer(({ store }) => {
  const theme = useTheme();
  const ratingOptions = useMemo(
    () => (theme.palette.mode === 'dark' ? DARK_RATING_OPTIONS : LIGHT_RATING_OPTIONS),
    [theme.palette.mode]
  );
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const rating = store.retroRating;
  const isAdmin = store.currentUser?.role === 'admin';
  const canShowResults = isAdmin && rating.votesCount >= rating.totalCount && rating.totalCount > 0;

  const handleSubmit = () => {
    if (!selectedRating) return;
    store.socketService?.submitRetroRating(selectedRating);
  };

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 820, p: { xs: 2.5, md: 3 }, borderRadius: 1 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.15, mb: 2, fontSize: { xs: '2rem', md: '2.75rem' } }}>
          Оцените ретро
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Стоило ли это ретро нашего времени? Оцените ретро от 1 до 5. Будьте честны — это анонимно!
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          После того, как все выберут оценку, ведущий отобразит результаты.
        </Typography>

        <Box sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Stepper activeStep={rating.resultsVisible ? 1 : 0} alternativeLabel sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Step>
              <StepLabel>Оценка</StepLabel>
            </Step>
            <Step>
              <StepLabel>Просмотр результатов</StepLabel>
            </Step>
          </Stepper>

          {!rating.resultsVisible ? (
            <Box>
              {ratingOptions.map((option) => (
                <Box
                  key={option.value}
                  onClick={() => !rating.hasVoted && setSelectedRating(option.value)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.4,
                    cursor: rating.hasVoted ? 'default' : 'pointer',
                    bgcolor: option.bgcolor,
                    color: option.color,
                    opacity: rating.hasVoted && selectedRating !== option.value ? 0.75 : 1
                  }}
                >
                  <Radio
                    checked={selectedRating === option.value || (rating.hasVoted && selectedRating === option.value)}
                    disabled={rating.hasVoted}
                    onChange={() => setSelectedRating(option.value)}
                    sx={{
                      color: option.color,
                      '&.Mui-checked': { color: option.color }
                    }}
                  />
                  <Typography sx={{ fontWeight: 700 }}>
                    {option.value} — {option.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ p: 2.5 }}>
              <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 700 }}>
                Результаты оценки
              </Typography>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Средняя оценка: <b>{rating.average?.toFixed(1) ?? '—'}</b>
              </Typography>
              {ratingOptions.map((option) => {
                const count = rating.distribution?.[option.value] || 0;
                const percent = rating.votesCount > 0 ? Math.round((count / rating.votesCount) * 100) : 0;
                return (
                  <Box key={option.value} sx={{ mb: 1.25 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="body2">{option.value} — {option.label}</Typography>
                      <Typography variant="body2">{count} ({percent}%)</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={percent}
                      sx={{
                        height: 10,
                        borderRadius: 999,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                        '& .MuiLinearProgress-bar': { bgcolor: option.barColor }
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          {!rating.resultsVisible && (
            <>
              <Button variant="contained" onClick={handleSubmit} disabled={!selectedRating || rating.hasVoted}>
                {rating.hasVoted ? 'Оценка принята' : 'Отправить оценку'}
              </Button>
              {isAdmin && (
                <Button variant="contained" color="info" onClick={() => store.socketService?.showRetroRatingResults()} disabled={!canShowResults}>
                  Показать результаты
                </Button>
              )}
            </>
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
          {rating.votesCount} / {rating.totalCount} участников проголосовало
        </Typography>
      </Paper>
    </Box>
  );
});

export default RetroRatingView;
