import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';
import { Mood } from '../../types';

const MOOD_OPTIONS: Array<{ value: Mood; emoji: string; label: string; color: string; labelColor: string }> = [
  { value: 'great', emoji: '😀', label: 'Великолепно', color: '#34c759', labelColor: '#ffffff' },
  { value: 'good', emoji: '🙂', label: 'Хорошо', color: '#8fd400', labelColor: '#1f1f1f' },
  { value: 'neutral', emoji: '😐', label: 'Нормально', color: '#f2d000', labelColor: '#1f1f1f' },
  { value: 'bad', emoji: '🙁', label: 'Плохо', color: '#e9b000', labelColor: '#1f1f1f' },
  { value: 'awful', emoji: '😠', label: 'Злой', color: '#ff5b62', labelColor: '#ffffff' }
];

export const RoomRejoinDialog: React.FC<{
  open: boolean;
  password: string;
  error: string | null;
  busy: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onLeave: () => void;
}> = ({ open, password, error, busy, onPasswordChange, onSubmit, onLeave }) => (
  <Dialog open={open} maxWidth="xs" fullWidth>
    <DialogTitle>Нужен пароль комнаты</DialogTitle>
    <DialogContent>
      <DialogContentText sx={{ mb: 2 }}>
        Сессия комнаты истекла. Введите пароль, чтобы вернуться на доску.
      </DialogContentText>
      <TextField
        autoFocus
        fullWidth
        type="password"
        label="Пароль"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit();
        }}
        error={Boolean(error)}
        helperText={error || ' '}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onLeave} disabled={busy}>Выйти</Button>
      <Button variant="contained" onClick={onSubmit} disabled={busy}>Войти</Button>
    </DialogActions>
  </Dialog>
);

export const FacilitatorDialog: React.FC<{
  open: boolean;
  userName?: string;
  onClose: () => void;
}> = ({ open, userName, onClose }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Ведущий выбран</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Карточки читает {userName}
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button variant="contained" onClick={onClose}>
        Понятно
      </Button>
    </DialogActions>
  </Dialog>
);

export const MoodDialog: React.FC<{
  open: boolean;
  selectedMood: Mood | null;
  onSelect: (mood: Mood) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ open, selectedMood, onSelect, onClose, onSave }) => (
  <Dialog
    open={open}
    onClose={(_, reason) => {
      if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
      onClose();
    }}
  >
    <DialogTitle>Как ваше самочувствие?</DialogTitle>
    <DialogContent>
      <DialogContentText sx={{ mb: 2 }}>
        Выберите смайлик, который отражает ваше самочувствие и отношение к спринту
      </DialogContentText>
      <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', alignItems: 'center', mb: 1 }}>
          {MOOD_OPTIONS.map((option) => {
            const isActive = selectedMood === option.value;
            return (
              <Box key={option.value} sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  onClick={() => onSelect(option.value)}
                  sx={{
                    minWidth: 56,
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    fontSize: '1.65rem',
                    bgcolor: option.color,
                    border: isActive ? '3px solid' : '1px solid',
                    borderColor: isActive ? 'text.primary' : 'transparent',
                    lineHeight: 1
                  }}
                >
                  {option.emoji}
                </Button>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderRadius: 999, overflow: 'hidden' }}>
          {MOOD_OPTIONS.map((option) => (
            <Box
              key={option.value}
              sx={{
                height: 28,
                bgcolor: option.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 0.5
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: option.labelColor,
                  fontSize: '0.68rem',
                  lineHeight: 1.1,
                  fontWeight: 600,
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                {option.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </DialogContent>
    <DialogActions>
      <Button variant="contained" onClick={onSave} disabled={!selectedMood}>
        Сохранить
      </Button>
    </DialogActions>
  </Dialog>
);

export const AllReadyDialog: React.FC<{
  open: boolean;
  totalCount: number;
  phaseLabel: string;
  nextPhaseLabel: string | null;
  onAdvance: () => void;
  onClose: () => void;
}> = ({ open, totalCount, phaseLabel, nextPhaseLabel, onAdvance, onClose }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Все готовы</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Все участники ({totalCount}) отметили готовность на этапе «{phaseLabel}».
      </DialogContentText>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      {nextPhaseLabel && (
        <Button variant="contained" color="secondary" onClick={onAdvance} sx={{ color: 'white' }}>
          {nextPhaseLabel}
        </Button>
      )}
      <Button variant="outlined" onClick={onClose}>
        ОК
      </Button>
    </DialogActions>
  </Dialog>
);
