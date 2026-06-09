import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
  Typography
} from '@mui/material';

interface Props {
  open: boolean;
  currentUserName: string;
  isLoading: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; password: string; members: string[]; scrumMasterName?: string }) => void;
}

const CreateTeamDialog: React.FC<Props> = ({ open, currentUserName, isLoading, onClose, onCreate }) => {
  const [teamName, setTeamName] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [memberName, setMemberName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [scrumMasterName, setScrumMasterName] = useState('');

  const scrumMasterOptions = useMemo(() => Array.from(new Set(members)).filter(Boolean), [members]);

  const reset = () => {
    setTeamName('');
    setTeamPassword('');
    setMemberName('');
    setMembers([]);
    setScrumMasterName('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAddMember = () => {
    const name = memberName.trim();
    if (!name || name === currentUserName) {
      setMemberName('');
      return;
    }
    setMembers((current) => (current.includes(name) ? current : [...current, name]));
    setMemberName('');
  };

  const handleRemoveMember = (name: string) => {
    setMembers((current) => current.filter((member) => member !== name));
    if (scrumMasterName === name) {
      setScrumMasterName('');
    }
  };

  const handleCreate = () => {
    if (!teamName.trim() || !teamPassword.trim()) return;
    onCreate({
      name: teamName.trim(),
      password: teamPassword.trim(),
      members,
      scrumMasterName: scrumMasterName || undefined
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Создать команду</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          У команды будет отдельное лобби комнат. Скрам-мастер станет админом команды; если не выбрать скрам-мастера,
          админом будет создатель.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label="Название команды"
          margin="normal"
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          disabled={isLoading}
        />
        <TextField
          fullWidth
          type="password"
          label="Пароль команды"
          margin="normal"
          value={teamPassword}
          onChange={(event) => setTeamPassword(event.target.value)}
          disabled={isLoading}
        />
        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          Члены команды
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Вы уже добавлены как: <b>{currentUserName}</b>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 1 }}>
          <TextField
            fullWidth
            label="ФИО участника"
            value={memberName}
            onChange={(event) => setMemberName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddMember();
              }
            }}
            disabled={isLoading}
          />
          <Button variant="outlined" sx={{ mt: 1 }} onClick={handleAddMember} disabled={isLoading || !memberName.trim()}>
            Добавить
          </Button>
        </Box>
        {members.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
            {members.map((name) => (
              <Box
                key={name}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  bgcolor: 'action.hover'
                }}
              >
                <Typography variant="body2">{name}</Typography>
                <Button size="small" color="error" onClick={() => handleRemoveMember(name)} disabled={isLoading}>
                  Удалить
                </Button>
              </Box>
            ))}
          </Box>
        )}
        <TextField
          fullWidth
          select
          label="Скрам-мастер"
          margin="normal"
          value={scrumMasterName}
          onChange={(event) => setScrumMasterName(event.target.value)}
          helperText="Необязательно: если не выбрать, админом станет создатель команды."
          disabled={isLoading}
        >
          <MenuItem value="">Создатель команды ({currentUserName})</MenuItem>
          {scrumMasterOptions.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Отмена
        </Button>
        <Button variant="contained" onClick={handleCreate} disabled={isLoading || !teamName.trim() || !teamPassword.trim()}>
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Создать команду'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateTeamDialog;
