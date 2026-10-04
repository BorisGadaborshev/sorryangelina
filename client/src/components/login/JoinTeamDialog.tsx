import React from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@mui/material';

interface Props {
  open: boolean;
  teamName?: string;
  password: string;
  error: string | null;
  isLoading: boolean;
  submitLabel: string;
  onPassword: (value: string) => void;
  onClearError: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

const JoinTeamDialog: React.FC<Props> = ({
  open,
  teamName,
  password,
  error,
  isLoading,
  submitLabel,
  onPassword,
  onClearError,
  onClose,
  onSubmit
}) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>Войти в команду {teamName}</DialogTitle>
    <DialogContent>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <TextField
        autoFocus
        fullWidth
        type="password"
        label="Пароль команды"
        margin="normal"
        value={password}
        onChange={(event) => {
          onPassword(event.target.value);
          if (error) onClearError();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Отмена</Button>
      <Button variant="contained" onClick={onSubmit} disabled={isLoading || !password.trim()}>
        {isLoading ? <CircularProgress size={18} color="inherit" /> : submitLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default JoinTeamDialog;
