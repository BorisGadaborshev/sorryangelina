import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, IconButton, LinearProgress, Paper, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { RetroStore } from '../store/RetroStore';
import { COLUMN_COLOR_IDS, ColumnColorId, getColumnColorStyles, MAX_WARMUP_ANSWER_LENGTH } from '../types';

const ANSWER_COLORS = COLUMN_COLOR_IDS.filter((id): id is ColumnColorId => id !== 'none');

interface Props {
  store: RetroStore;
}

const WarmupView: React.FC<Props> = observer(({ store }) => {
  const theme = useTheme();
  const warmup = store.warmup;
  const questions = warmup.questions.length > 0
    ? warmup.questions
    : (store.room?.warmupQuestions ?? []);
  const [drafts, setDrafts] = useState<string[]>(() => questions.map(() => ''));

  useEffect(() => {
    setDrafts((current) => {
      if (current.length === questions.length) return current;
      return questions.map((_, index) => current[index] ?? '');
    });
  }, [questions]);

  const canSubmit = !warmup.submitted
    && questions.length > 0
    && drafts.length === questions.length
    && drafts.every((answer) => answer.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit) return;
    store.socketService?.submitWarmupAnswers(drafts.map((answer) => answer.trim()));
  };

  const handleClose = () => {
    if (!store.isAdmin) return;
    store.socketService?.changePhase('creation');
  };

  const waitingForOthers = warmup.submitted && !warmup.resultsVisible;
  const progress = warmup.totalCount > 0
    ? Math.min(100, (warmup.submittedCount / warmup.totalCount) * 100)
    : 0;

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 820, p: { xs: 2.5, md: 3 }, borderRadius: 1, position: 'relative' }}>
        {store.isAdmin && (
          <IconButton
            aria-label="Закрыть"
            onClick={handleClose}
            sx={{ position: 'absolute', top: 8, right: 8 }}
          >
            <CloseIcon />
          </IconButton>
        )}
        <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.15, mb: 2, pr: 5, fontSize: { xs: '2rem', md: '2.75rem' } }}>
          Разминка
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1.5 }}>
          Коротко отвечаем на вопросы команды. Когда ответят все, покажем ответы анонимно — без имён.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Дождитесь, пока команда соберётся в комнате, и только потом отправляйте ответы.
        </Typography>

        <Box sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Stepper activeStep={warmup.resultsVisible ? 1 : 0} alternativeLabel sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Step>
              <StepLabel>Ответы</StepLabel>
            </Step>
            <Step>
              <StepLabel>Общий просмотр</StepLabel>
            </Step>
          </Stepper>

          {!warmup.resultsVisible ? (
            <Box sx={{ p: 2.5 }}>
              {questions.map((question, index) => (
                <TextField
                  key={`${index}-${question}`}
                  fullWidth
                  multiline
                  minRows={2}
                  label={question}
                  margin="normal"
                  value={drafts[index] ?? ''}
                  disabled={warmup.submitted}
                  inputProps={{ maxLength: MAX_WARMUP_ANSWER_LENGTH }}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
                  }}
                />
              ))}
              {waitingForOthers ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Ждём остальных: {warmup.submittedCount} из {warmup.totalCount}
                  </Typography>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
              ) : (
                <Button
                  variant="contained"
                  sx={{ mt: 2 }}
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  Отправить ответы
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{ p: 2.5 }}>
              {questions.map((question, index) => (
                <Box key={`${index}-${question}`} sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                    {question}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
                    {(warmup.answers?.[index] ?? []).map((answer, answerIndex) => {
                      const colorId = ANSWER_COLORS[answerIndex % ANSWER_COLORS.length];
                      const colors = getColumnColorStyles(colorId, theme.palette.mode);
                      return (
                        <Paper
                          key={`${index}-${answerIndex}`}
                          variant="outlined"
                          sx={{
                            flex: '0 1 140px',
                            maxWidth: 180,
                            p: 1,
                            bgcolor: colors.fill,
                            borderColor: colors.accent,
                            borderWidth: 1
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 800, color: colors.accent, lineHeight: 1.4, flexShrink: 0 }}
                            >
                              {answerIndex + 1}.
                            </Typography>
                            <Typography variant="body2" sx={{ overflowWrap: 'anywhere', lineHeight: 1.4 }}>
                              {answer}
                            </Typography>
                          </Box>
                        </Paper>
                      );
                    })}
                    {(warmup.answers?.[index]?.length ?? 0) === 0 && (
                      <Typography variant="body2" color="text.secondary">Пока нет ответов</Typography>
                    )}
                  </Box>
                </Box>
              ))}
              {store.isAdmin && (
                <Button variant="contained" onClick={handleClose}>
                  Закрыть
                </Button>
              )}
            </Box>
          )}
        </Box>
        {store.isAdmin && !warmup.resultsVisible && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleClose}>Закрыть</Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
});

export default WarmupView;
