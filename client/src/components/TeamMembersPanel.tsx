import React from 'react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import KeyIcon from '@mui/icons-material/VpnKey';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Tooltip,
  Typography
} from '@mui/material';
import { TeamMember } from '../types';

interface Props {
  members: TeamMember[];
  owner: string;
  currentUserName: string;
  isAdmin: boolean;
  isLoading: boolean;
  busyMemberName: string | null;
  onRemoveMember: (name: string) => void;
  onResetPassword: (name: string) => void;
  onChangeTeamPassword: () => void;
}

const TeamMembersPanel: React.FC<Props> = ({
  members,
  owner,
  currentUserName,
  isAdmin,
  isLoading,
  busyMemberName,
  onRemoveMember,
  onResetPassword,
  onChangeTeamPassword
}) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        width: { xs: '100%', md: 320 },
        maxWidth: '100%',
        flexShrink: 0,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: { xs: 420, md: 'calc(100vh - 120px)' },
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle1" sx={{ px: 0.5 }}>
          Участники ({members.length})
        </Typography>
        {isAdmin && (
          <Tooltip title="Сменить пароль команды">
            <IconButton size="small" onClick={onChangeTeamPassword}>
              <LockResetIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, mb: 1, display: 'block' }}>
        {isAdmin
          ? 'Вы можете удалить участника, сбросить ему пароль или сменить пароль команды'
          : 'Список участников команды'}
      </Typography>
      {isLoading && members.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <List dense sx={{ overflow: 'auto', flex: 1 }}>
          {members.map((member) => {
            const isOwner = member.name === owner;
            const isSelf = member.name === currentUserName;
            const canManage = isAdmin && !isSelf && !isOwner;
            const isBusy = busyMemberName === member.name;

            return (
              <ListItem
                key={member.name}
                secondaryAction={
                  canManage ? (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {isBusy ? (
                        <CircularProgress size={18} sx={{ mr: 1 }} />
                      ) : (
                        <>
                          <Tooltip title="Сбросить пароль">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => onResetPassword(member.name)}
                            >
                              <KeyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить из команды">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => onRemoveMember(member.name)}
                            >
                              <PersonRemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  ) : undefined
                }
                sx={{ pr: canManage ? 10 : 1 }}
              >
                <ListItemText
                  primary={member.name}
                  primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                  secondary={
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                      {isOwner && <Chip size="small" label="Создатель" />}
                      {member.role === 'admin' && (
                        <Chip
                          size="small"
                          color="primary"
                          variant="outlined"
                          icon={<AdminPanelSettingsIcon />}
                          label="Админ"
                        />
                      )}
                      {isSelf && <Chip size="small" variant="outlined" label="Вы" />}
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
};

export default TeamMembersPanel;
