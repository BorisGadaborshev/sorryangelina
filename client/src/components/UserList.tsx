import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, List, ListItem, ListItemText, Typography, Avatar, Button, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { RetroStore } from '../store/RetroStore';
import { BUILTIN_TEAM_ID, Mood, Phase } from '../types';
import { getReadyButtonSx } from './readyButtonStyles';
import { getApiBase } from '../utils/apiBase';
import { apiFetch } from '../utils/apiFetch';
import { isAbortError } from '../utils/errors';

interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
  isReady?: boolean;
  mood?: Mood;
}

interface UserListProps {
  users: User[];
  currentUserId: string;
  currentPhase: Phase;
  onReadyStateChange: (isReady: boolean) => void;
  store: RetroStore;
  showReadyControl?: boolean;
}

const UserList: React.FC<UserListProps> = observer(({ 
  users, 
  currentUserId,
  currentPhase,
  onReadyStateChange,
  store,
  showReadyControl = true,
}) => {
  const [rosterUsers, setRosterUsers] = useState<string[]>([]);
  const [isOfflineExpanded, setIsOfflineExpanded] = useState(true);
  const [kickCandidateId, setKickCandidateId] = useState<string | null>(null);
  const teamId = store.room?.teamId
    || store.selectedTeam?.id
    || (store.authProfile?.type === 'fixed' ? BUILTIN_TEAM_ID : undefined);
  const isBuiltinTeam = teamId === BUILTIN_TEAM_ID;
  const currentUser = users.find(u => u.id === currentUserId)
    || users.find(u => u.name === store.currentUser?.name);
  const isAdmin = currentUser?.role === 'admin';
  const readyEnabled = store.roomFeatures.readyEnabled;
  const myVipVote = store.sprintVip.myVote;
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const vipVoteHighlight = {
    bg: isDark ? 'rgba(240, 193, 74, 0.14)' : 'rgba(255, 249, 196, 0.72)',
    border: isDark ? 'rgba(240, 193, 74, 0.55)' : 'rgba(214, 158, 0, 0.55)',
    text: isDark ? '#f0c14a' : '#8D6E00',
  };
  const readyCount = users.filter((user) => user.isReady).length;

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

    const controller = new AbortController();
    const fetchRosterUsers = async () => {
      try {
        const apiBase = getApiBase();
        const headers: Record<string, string> = {};
        const accessCode = localStorage.getItem('suboAccessCode');
        if (accessCode) {
          headers['X-Subo-Access'] = accessCode;
        }
        if (store.authProfile?.token) {
          headers.Authorization = `Bearer ${store.authProfile.token}`;
        }
        const response = await apiFetch(`${apiBase}/api/teams/${encodeURIComponent(teamId)}/members`, {
          headers,
          signal: controller.signal
        });
        if (!response.ok) return;
        const data = (await response.json()) as { members: string[] };
        setRosterUsers(data.members || []);
      } catch (error) {
        if (isAbortError(error)) return;
      }
    };

    fetchRosterUsers();
    return () => controller.abort();
  }, [teamId, store.authProfile?.token]);

  const offlineRosterUsers = useMemo(() => {
    const onlineNames = new Set(users.map((user) => user.name));
    return rosterUsers.filter((name) => !onlineNames.has(name));
  }, [rosterUsers, users]);

  const kickCandidate = users.find((user) => user.id === kickCandidateId) ?? null;

  const handleKickUser = (userId: string) => {
    if (isAdmin && userId !== currentUserId) {
      setKickCandidateId(userId);
    }
  };

  const closeKickDialog = () => {
    setKickCandidateId(null);
  };

  const confirmKickUser = () => {
    if (kickCandidate && isAdmin && kickCandidate.id !== currentUserId) {
      store.socketService?.kickUser(kickCandidate.id);
    }
    setKickCandidateId(null);
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
      case 'roadmap':
        return 'собрал(а) дорожную карту';
      case 'rating':
        return 'оценил(а) ретро';
      default:
        return 'готов(а)';
    }
  };

  const rowSurface = isDark ? 'rgba(255,255,255,0.045)' : 'rgba(20, 24, 40, 0.035)';
  const actionButtonSx = {
    width: 28,
    height: 28,
  };

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      minHeight: 0,
      maxWidth: 360,
      bgcolor: 'background.paper',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: showReadyControl && readyEnabled ? 1 : 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Участники
          </Typography>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1,
              py: 0.4,
              borderRadius: '999px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20, 24, 40, 0.04)',
              flexShrink: 0
            }}
          >
            {readyEnabled && (
              <CheckCircleIcon sx={{ fontSize: 14, color: readyCount > 0 ? 'success.main' : 'text.disabled' }} />
            )}
            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>
              {readyEnabled ? `${readyCount}/${users.length}` : users.length}
            </Typography>
          </Box>
        </Box>
        {showReadyControl && readyEnabled && currentUser && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              {currentUser.isReady ? 'Вы отметили свою готовность' : 'Отметьте свою готовность'}
            </Typography>
            <Button
              variant="contained"
              fullWidth
              onClick={() => onReadyStateChange(!currentUser.isReady)}
              startIcon={currentUser.isReady ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
              sx={getReadyButtonSx(Boolean(currentUser.isReady))}
            >
              {currentUser.isReady ? 'Я готов(а)' : 'Отметить готовность'}
            </Button>
          </>
        )}
      </Box>
      {store.roomFeatures.sprintVipEnabled && (
        <Box sx={{ px: 1.5, pb: 1, flexShrink: 0 }}>
          <Box
            sx={{
              px: 1.25,
              py: 1,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(240, 193, 74, 0.1)' : 'rgba(255, 193, 7, 0.14)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(240, 193, 74, 0.28)' : 'rgba(214, 158, 0, 0.28)'
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 13, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              VIP спринта{store.sprintVip.voteCount > 0 ? ` · ${store.sprintVip.voteCount}` : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>
              Нажмите на имя, чтобы проголосовать
            </Typography>
            {myVipVote && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.35, fontWeight: 700, color: vipVoteHighlight.text }}>
                Ваш голос: {myVipVote}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, pb: 1 }}>
        <List sx={{ py: 0 }}>
          {users.map((user) => {
            const moodMeta = getMoodMeta(user.mood);
            const isSprintVip = store.sprintVip.vipUserName === user.name;
            const isMyVipVote = myVipVote === user.name;
            const isMe = user.id === currentUserId;
            const canVoteForUser = store.roomFeatures.sprintVipEnabled && Boolean(currentUser && user.name !== currentUser.name);
            const handRaised = currentPhase === 'discussion' && store.discussionHands.includes(user.name);
            const roleLabel = isSprintVip
              ? 'VIP спринта'
              : isMyVipVote
                ? 'Ваш выбор'
                : (user.role === 'admin' ? 'Администратор' : 'Участник');
            const voteTooltip = !store.roomFeatures.sprintVipEnabled
              ? ''
              : !canVoteForUser
                ? 'Нельзя голосовать за себя'
                : isMyVipVote
                  ? 'Нажмите еще раз, чтобы снять голос'
                  : 'Проголосовать за VIP спринта';
            const readyTint = isDark ? 'rgba(52, 199, 89, 0.16)' : 'rgba(52, 199, 89, 0.14)';

            return (
              <ListItem
                key={user.id}
                disablePadding
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  borderRadius: '12px',
                  mb: 0.75,
                  px: 1,
                  py: 0.75,
                  border: '1px solid',
                  borderColor: isMyVipVote
                    ? vipVoteHighlight.border
                    : isMe
                      ? (isDark ? 'rgba(108, 99, 255, 0.45)' : 'rgba(108, 99, 255, 0.35)')
                      : 'transparent',
                  bgcolor: readyEnabled && isMe && user.isReady
                    ? readyTint
                    : isMyVipVote
                      ? vipVoteHighlight.bg
                      : rowSurface,
                }}
              >
                <Tooltip title={voteTooltip} disableHoverListener={!voteTooltip} disableFocusListener={!voteTooltip}>
                  <Box
                    onClick={() => canVoteForUser && handleVoteSprintVip(user.name)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      flex: 1,
                      minWidth: 0,
                      cursor: canVoteForUser ? 'pointer' : 'default',
                      borderRadius: '8px',
                    }}
                  >
                    <Box sx={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          fontSize: 18,
                          bgcolor: moodMeta?.color ?? (user.role === 'admin' ? '#6c63ff' : '#5c6b7a'),
                          boxShadow: isMe ? '0 0 0 2px rgba(108, 99, 255, 0.35)' : 'none'
                        }}
                      >
                        {moodMeta?.emoji ?? (user.role === 'admin' ? <AdminPanelSettingsIcon sx={{ fontSize: 18 }} /> : <PersonIcon sx={{ fontSize: 18 }} />)}
                      </Avatar>
                      {isSprintVip && (
                        <Box
                          component="span"
                          sx={{
                            position: 'absolute',
                            top: -7,
                            left: -4,
                            fontSize: 14,
                            lineHeight: 1
                          }}
                        >
                          👑
                        </Box>
                      )}
                      {handRaised && (
                        <Box
                          component="span"
                          title="Поднял руку"
                          sx={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            fontSize: 13,
                            lineHeight: 1
                          }}
                        >
                          ✋
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        title={user.name}
                        sx={{
                          fontWeight: 700,
                          fontSize: 13.5,
                          lineHeight: 1.25,
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {user.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 0.15,
                          fontWeight: 700,
                          fontSize: 11,
                          lineHeight: 1.2,
                          color: isSprintVip || isMyVipVote
                            ? vipVoteHighlight.text
                            : (user.role === 'admin' ? (isDark ? '#b7b2ff' : '#5b54e8') : 'text.secondary'),
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isMe ? 'Вы · ' : ''}{roleLabel}
                      </Typography>
                    </Box>
                  </Box>
                </Tooltip>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {readyEnabled && (
                    <Tooltip
                      title={
                        isMe
                          ? (user.isReady ? `Вы ${getPhaseActionText(currentPhase)}` : 'Вы еще не готовы')
                          : (user.isReady ? `${user.name} ${getPhaseActionText(currentPhase)}` : `${user.name} еще не готов(а)`)
                      }
                    >
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        color: user.isReady ? 'success.main' : 'text.disabled',
                        px: 0.25
                      }}>
                        {user.isReady ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />}
                      </Box>
                    </Tooltip>
                  )}
                  {isAdmin && user.id !== currentUserId && user.role !== 'admin' && (
                    <Tooltip title="Назначить администратором">
                      <IconButton
                        size="small"
                        aria-label="Назначить администратором"
                        onClick={(event) => handleTransferAdmin(event, user.id)}
                        sx={{ ...actionButtonSx, color: isDark ? '#b7b2ff' : '#5b54e8' }}
                      >
                        <AdminPanelSettingsIcon sx={{ fontSize: 16, color: isDark ? '#b7b2ff' : '#5b54e8' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {isAdmin && user.id !== currentUserId && (
                    <Tooltip title="Исключить с ретро" {...(kickCandidateId ? { open: false } : {})}>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Исключить ${user.name} с ретро`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleKickUser(user.id);
                        }}
                        sx={actionButtonSx}
                      >
                        <PersonRemoveIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </ListItem>
            );
          })}
        </List>
        {offlineRosterUsers.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Box
              component="button"
              type="button"
              onClick={() => setIsOfflineExpanded((prev) => !prev)}
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 1,
                py: 0.75,
                mb: 0.5,
                border: 0,
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'text.secondary',
                bgcolor: 'transparent',
                font: 'inherit',
                '&:hover': {
                  bgcolor: rowSurface
                }
              }}
            >
              <Typography variant="caption" color="inherit" sx={{ fontWeight: 800, letterSpacing: '0.02em' }}>
                {isBuiltinTeam ? 'Оффлайн, фиксированные' : 'Оффлайн, команда'} · {offlineRosterUsers.length}
              </Typography>
              {isOfflineExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </Box>
            {isOfflineExpanded && (
              <List dense disablePadding>
                {offlineRosterUsers.map((name) => (
                  <ListItem
                    key={name}
                    disablePadding
                    sx={{
                      borderRadius: '10px',
                      px: 1,
                      py: 0.6,
                      mb: 0.25,
                      opacity: 0.72
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        mr: 1.25,
                        bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'grey.400',
                        color: isDark ? 'rgba(255,255,255,0.7)' : undefined
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                    <ListItemText
                      primary={name}
                      secondary="Оффлайн"
                      sx={{
                        my: 0,
                        '& .MuiListItemText-primary': {
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        },
                        '& .MuiListItemText-secondary': {
                          color: 'text.disabled',
                          fontSize: 11,
                          lineHeight: 1.2
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
      <Dialog
        open={Boolean(kickCandidate)}
        onClose={closeKickDialog}
        fullWidth
        maxWidth="xs"
        sx={{ zIndex: (theme) => theme.zIndex.tooltip + 1 }}
      >
        <DialogTitle>Исключить участника</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ overflowWrap: 'anywhere' }}>
            Точно исключить <b>{kickCandidate?.name}</b> с ретро?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeKickDialog}>Отмена</Button>
          <Button color="error" variant="contained" onClick={confirmKickUser}>
            Исключить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default UserList; 