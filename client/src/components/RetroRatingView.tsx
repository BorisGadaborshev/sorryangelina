import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, LinearProgress, Paper, Radio, Step, StepLabel, Stepper, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { RetroStore } from '../store/RetroStore';

interface Props {
  store: RetroStore;
}

const RATING_OPTIONS: Array<{ value: 1 | 2 | 3 | 4 | 5; label: string; color: string }> = [
  { value: 1, label: 'Определенно не стоит нашего времени', color: '#f8fafc' },
  { value: 2, label: 'Вероятно, не стоит нашего времени', color: '#e4e7ef' },
  { value: 3, label: 'Стоит нашего времени', color: '#9be7c6' },
  { value: 4, label: 'Хорошее использование нашего времени', color: '#12d28a' },
  { value: 5, label: 'Отличное использование нашего времени', color: '#07bf72' }
];

const RetroRatingView: React.FC<Props> = observer(({ store }) => {
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
              {RATING_OPTIONS.map((option) => (
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
                    bgcolor: option.color,
                    color: option.value >= 4 ? '#06251a' : 'text.primary',
                    opacity: rating.hasVoted && selectedRating !== option.value ? 0.75 : 1
                  }}
                >
                  <Radio
                    checked={selectedRating === option.value || (rating.hasVoted && selectedRating === option.value)}
                    disabled={rating.hasVoted}
                    onChange={() => setSelectedRating(option.value)}
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
              {RATING_OPTIONS.map((option) => {
                const count = rating.distribution?.[option.value] || 0;
                const percent = rating.votesCount > 0 ? Math.round((count / rating.votesCount) * 100) : 0;
                return (
                  <Box key={option.value} sx={{ mb: 1.25 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="body2">{option.value} — {option.label}</Typography>
                      <Typography variant="body2">{count} ({percent}%)</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={percent} sx={{ height: 10, borderRadius: 999 }} />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<HelpOutlineIcon />}>
            Помощь
          </Button>
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
