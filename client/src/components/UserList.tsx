import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, List, ListItem, ListItemText, Typography, Avatar, Button, Tooltip, IconButton } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { RetroStore } from '../store/RetroStore';
import { BUILTIN_TEAM_ID, Mood, Phase } from '../types';

interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
  isReady?: boolean;
  mood?: Mood;
}

interface UserListProps {
  users: User[];
  onlineUsers: string[]; // массив ID пользователей онлайн
  currentUserId: string;
  currentPhase: Phase;
  onReadyStateChange: (isReady: boolean) => void;
  store: RetroStore;
}

const UserList: React.FC<UserListProps> = observer(({ 
  users, 
  onlineUsers, 
  currentUserId,
  currentPhase,
  onReadyStateChange,
  store
}) => {
  const [rosterUsers, setRosterUsers] = useState<string[]>([]);
  const [isOfflineExpanded, setIsOfflineExpanded] = useState(true);
  const teamId = store.room?.teamId
    || store.selectedTeam?.id
    || (store.authProfile?.type === 'fixed' ? BUILTIN_TEAM_ID : undefined);
  const isBuiltinTeam = teamId === BUILTIN_TEAM_ID;
  const currentUser = users.find(u => u.id === currentUserId);
  const isAdmin = currentUser?.role === 'admin';
  const myVipVote = store.sprintVip.myVote;
  const vipVoteHighlight = {
    bg: 'rgba(255, 249, 196, 0.55)',
    border: 'rgba(255, 224, 130, 0.75)',
    text: '#8D6E00',
  };

  const handleVoteSprintVip = (userName: string) => {
    if (!store.roomFeatures.sprintVipEnabled) return;
    if (!currentUser || userName === currentUser.name) return;
    store.socketService?.voteSprintVip(userName);
  };

  useEffect(() => {
    if (!teamId) {
      setRosterUsers([]);
      return;
    }

    const fetchRosterUsers = async () => {
      try {
        const apiBase = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
        const response = await fetch(`${apiBase}/api/teams/${encodeURIComponent(teamId)}/members`);
        if (!response.ok) return;
        const data = (await response.json()) as { members: string[] };
        setRosterUsers(data.members || []);
      } catch (error) {
        // Silent fail: participant list should still work.
      }
    };

    fetchRosterUsers();
  }, [teamId]);

  const offlineRosterUsers = useMemo(() => {
    const onlineNames = new Set(users.map((user) => user.name));
    return rosterUsers.filter((name) => !onlineNames.has(name));
  }, [rosterUsers, users]);

  const handleKickUser = (userId: string) => {
    if (isAdmin && userId !== currentUserId) {
      store.socketService?.kickUser(userId);
    }
  };

  const handleTransferAdmin = (event: React.MouseEvent, userId: string) => {
    event.stopPropagation();
    if (isAdmin && userId !== currentUserId) {
      store.socketService?.transferRoomAdmin(userId);
    }
  };

  const getMoodMeta = (mood?: Mood): { emoji: string; color: string } | null => {
    if (mood === 'great') return { emoji: '😀', color: '#34c759' };
    if (mood === 'good') return { emoji: '🙂', color: '#8fd400' };
    if (mood === 'neutral') return { emoji: '😐', color: '#f2d000' };
    if (mood === 'bad') return { emoji: '🙁', color: '#e9b000' };
    if (mood === 'awful') return { emoji: '😠', color: '#ff5b62' };
    return null;
  };

  const getPhaseActionText = (phase: string): string => {
    switch (phase) {
      case 'creation':
        return 'создал(а) карточки';
      case 'voting':
        return 'проголосовал(а)';
      case 'discussion':
        return 'готов(а) к обсуждению';
      case 'rating':
        return 'оценил(а) ретро';
      default:
        return 'готов(а)';
    }
  };

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: 360, 
      bgcolor: 'background.paper',
      borderRadius: 1,
      boxShadow: 1,
      p: 1,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ p: 1 }}>
        <Typography variant="h6" gutterBottom>
          Участники ({users.length})
        </Typography>
        {currentUser && (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {currentUser.isReady ? 'Вы отметили свою готовность' : 'Отметьте свою готовность'}
            </Typography>
            <Button
              variant="contained"
              color={currentUser.isReady ? "success" : "primary"}
              fullWidth
              onClick={() => onReadyStateChange(!currentUser.isReady)}
              startIcon={currentUser.isReady ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
            >
              {currentUser.isReady ? 'Я готов(а)' : 'Отметить готовность'}
            </Button>
          </>
        )}
      </Box>
      {store.roomFeatures.sprintVipEnabled && (
      <Box sx={{ px: 1, pb: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          VIP спринта
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Нажмите на ФИО участника, чтобы проголосовать
          {store.sprintVip.voteCount > 0 ? ` (${store.sprintVip.voteCount} гол.)` : ''}
        </Typography>
        {myVipVote && (
          <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 0.5 }}>
            Ваш голос: {myVipVote}
          </Typography>
        )}
      </Box>
      )}
      <List>
        {users.map((user) => {
          const moodMeta = getMoodMeta(user.mood);
          const isSprintVip = store.sprintVip.vipUserName === user.name;
          const isMyVipVote = myVipVote === user.name;
          const canVoteForUser = store.roomFeatures.sprintVipEnabled && Boolean(currentUser && user.name !== currentUser.name);
          return (
          <ListItem
            key={user.id}
            onClick={() => handleVoteSprintVip(user.name)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              overflow: 'visible',
              cursor: canVoteForUser ? 'pointer' : 'default',
              border: isMyVipVote ? '2px solid' : '2px solid transparent',
              borderColor: isMyVipVote ? vipVoteHighlight.border : 'transparent',
              bgcolor: user.id === currentUserId && user.isReady
                ? 'success.light'
                : isMyVipVote
                  ? vipVoteHighlight.bg
                  : 'transparent',
              '&:hover': {
                bgcolor: canVoteForUser
                  ? (isMyVipVote ? vipVoteHighlight.bg : 'action.hover')
                  : (user.id === currentUserId && user.isReady ? 'success.light' : 'transparent'),
              },
            }}
          >
            <Box sx={{ position: 'relative', mr: 2 }}>
              {isSprintVip && (
                <Typography
                  component="span"
                  sx={{
                    position: 'absolute',
                    top: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 20,
                    lineHeight: 1,
                    zIndex: 1
                  }}
                >
                  👑
                </Typography>
              )}
              <Avatar
                sx={{
                  bgcolor: moodMeta?.color ?? (onlineUsers.includes(user.id) ? 'success.main' : 'grey.400'),
                }}
              >
                {moodMeta?.emoji ?? (user.role === 'admin' ? <AdminPanelSettingsIcon /> : <PersonIcon />)}
              </Avatar>
            </Box>
            <Tooltip
              title={
                !canVoteForUser
                  ? 'Нельзя голосовать за себя'
                  : isMyVipVote
                    ? 'Нажмите еще раз, чтобы снять голос'
                    : 'Проголосовать за VIP спринта'
              }
            >
              <ListItemText
                primary={user.name}
                secondary={
                  isSprintVip
                    ? 'VIP спринта'
                    : isMyVipVote
                      ? 'Ваш выбор'
                      : (user.role === 'admin' ? 'Администратор' : 'Участник')
                }
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: onlineUsers.includes(user.id) ? 'bold' : 'normal',
                  },
                  '& .MuiListItemText-secondary': {
                    color: isSprintVip
                      ? 'warning.main'
                      : isMyVipVote
                        ? vipVoteHighlight.text
                        : (user.role === 'admin' ? 'primary.main' : 'text.secondary'),
                  },
                }}
              />
            </Tooltip>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip
                title={
                  user.id === currentUserId
                    ? (user.isReady ? `Вы ${getPhaseActionText(currentPhase)}` : 'Вы еще не готовы')
                    : (user.isReady ? `${user.name} ${getPhaseActionText(currentPhase)}` : `${user.name} еще не готов(а)`)
                }
              >
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  color: user.isReady ? 'success.main' : 'text.disabled'
                }}>
                  {user.isReady ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                </Box>
              </Tooltip>
              {isAdmin && user.id !== currentUserId && user.role !== 'admin' && (
                <Tooltip title="Назначить администратором">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={(event) => handleTransferAdmin(event, user.id)}
                  >
                    <AdminPanelSettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {isAdmin && user.id !== currentUserId && (
                <Tooltip title="Исключить пользователя">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleKickUser(user.id);
                    }}
                  >
                    <PersonRemoveIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </ListItem>
        )})}
      </List>
      {offlineRosterUsers.length > 0 && (
        <Box sx={{ px: 1, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary">
              {isBuiltinTeam ? 'Оффлайн (фиксированные)' : 'Оффлайн (команда)'} ({offlineRosterUsers.length})
            </Typography>
            <IconButton size="small" onClick={() => setIsOfflineExpanded((prev) => !prev)}>
              {isOfflineExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          {isOfflineExpanded && (
            <List dense>
              {offlineRosterUsers.map((name) => (
                <ListItem key={name} sx={{ borderRadius: 1, opacity: 0.7 }}>
                  <Avatar
                    sx={{
                      mr: 2,
                      bgcolor: 'grey.400'
                    }}
                  >
                    <PersonIcon />
                  </Avatar>
                  <ListItemText
                    primary={name}
                    secondary="Оффлайн"
                    sx={{
                      '& .MuiListItemText-secondary': {
                        color: 'text.disabled'
                      }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  );
});

export default UserList; 