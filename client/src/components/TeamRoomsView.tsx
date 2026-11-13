import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  ButtonBase,
  IconButton,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { AvailableRoom, COLUMN_COLOR_PRESETS, MAX_WARMUP_QUESTIONS, MAX_WARMUP_QUESTION_LENGTH, RETRO_TEMPLATE_PICKER, RetroTemplateChoice } from '../types';
import { RetroStore } from '../store/RetroStore';
import RoomTiles from './RoomTiles';
import TeamMembersPanel from './TeamMembersPanel';

export type CreateWarmupKind = 'none' | 'questions' | 'charades';

export interface CreateRoomDialogState {
  open: boolean;
  roomId: string;
  password: string;
  template: RetroTemplateChoice;
  warmupKind: CreateWarmupKind;
  warmupQuestions: string[];
  questionsOpen: boolean;
  settingsLoaded: boolean;
  onRoomId: (value: string) => void;
  onPassword: (value: string) => void;
  onTemplate: (value: RetroTemplateChoice) => void;
  onWarmupKind: (value: CreateWarmupKind) => void;
  onWarmupQuestions: (value: string[]) => void;
  onOpenQuestions: () => void;
  onCloseQuestions: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export interface PasswordDialogState {
  open: boolean;
  roomId: string;
  password: string;
  error: string | null;
  onPassword: (value: string) => void;
  onClearError: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export interface DeleteRoomDialogState {
  open: boolean;
  roomId: string;
  confirmText: string;
  busy: boolean;
  onConfirmText: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export interface InviteDialogState {
  open: boolean;
  roomId: string;
  roomHasPassword: boolean | undefined;
  password: string;
  message: string;
  telegramLink: string;
  copied: boolean;
  onPassword: (value: string) => void;
  onClearCopied: () => void;
  onClose: () => void;
  onCopy: () => void;
}

export interface RemoveMemberDialogState {
  open: boolean;
  name: string;
  busyName: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

export interface ResetPasswordDialogState {
  open: boolean;
  name: string;
  password: string;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export interface ChangeTeamPasswordDialogState {
  open: boolean;
  value: string;
  error: string | null;
  busy: boolean;
  onValue: (value: string) => void;
  onClearError: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

interface Props {
  store: RetroStore;
  isLoading: boolean;
  isRoomsLoading: boolean;
  isTeamMembersLoading: boolean;
  currentUserName: string;
  isTeamAdmin: boolean;
  availableRooms: AvailableRoom[];
  onRefreshRooms: () => void;
  onChangeTeam: () => void;
  onLogout: () => void;
  onRoomClick: (roomId: string) => void;
  onCreateClick: () => void;
  onDeleteClick: (roomId: string) => void;
  onInviteClick: (roomId: string) => void;
  onRemoveMember: (name: string) => void;
  onResetPassword: (name: string) => void;
  onOpenChangeTeamPassword: () => void;
  createDialog: CreateRoomDialogState;
  joinDialog: PasswordDialogState;
  deleteDialog: DeleteRoomDialogState;
  inviteDialog: InviteDialogState;
  removeDialog: RemoveMemberDialogState;
  resetDialog: ResetPasswordDialogState;
  changePasswordDialog: ChangeTeamPasswordDialogState;
}

const TeamRoomsView: React.FC<Props> = ({
  store,
  isLoading,
  isRoomsLoading,
  isTeamMembersLoading,
  currentUserName,
  isTeamAdmin,
  availableRooms,
  onRefreshRooms,
  onChangeTeam,
  onLogout,
  onRoomClick,
  onCreateClick,
  onDeleteClick,
  onInviteClick,
  onRemoveMember,
  onResetPassword,
  onOpenChangeTeamPassword,
  createDialog,
  joinDialog,
  deleteDialog,
  inviteDialog,
  removeDialog,
  resetDialog,
  changePasswordDialog
}) => (
  <Box
    sx={{
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      bgcolor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
      p: { xs: 2, md: 3 }
    }}
  >
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'flex-start' },
        gap: 1.5,
        mb: 2
      }}
    >
      <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
        <Typography variant="h5" sx={{ overflowWrap: 'anywhere' }}>
          Комнаты команды {store.selectedTeam?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          Вы вошли как: <b>{store.authProfile?.name}</b>
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          flexWrap: { sm: 'wrap' },
          gap: 1,
          flexShrink: 0
        }}
      >
        <Button variant="outlined" onClick={onRefreshRooms} disabled={isRoomsLoading}>
          Обновить
        </Button>
        <Button variant="outlined" onClick={onChangeTeam}>
          Сменить команду
        </Button>
        <Button onClick={onLogout}>Выйти</Button>
      </Box>
    </Box>

    {store.error && (
      <Typography color="error" sx={{ mb: 2 }}>
        {store.error}
      </Typography>
    )}

    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        alignItems: { xs: 'stretch', md: 'flex-start' },
        minHeight: 0,
        minWidth: 0
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        {isRoomsLoading ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <RoomTiles
            rooms={availableRooms}
            currentUserName={store.authProfile?.name || ''}
            onRoomClick={onRoomClick}
            onCreateClick={onCreateClick}
            onDeleteClick={onDeleteClick}
            onInviteClick={onInviteClick}
          />
        )}
      </Box>
      <TeamMembersPanel
        members={store.selectedTeam?.members || []}
        owner={store.selectedTeam?.owner || ''}
        currentUserName={currentUserName}
        isAdmin={isTeamAdmin}
        isLoading={isTeamMembersLoading}
        busyMemberName={removeDialog.busyName}
        onRemoveMember={onRemoveMember}
        onResetPassword={onResetPassword}
        onChangeTeamPassword={onOpenChangeTeamPassword}
      />
    </Box>

    <Dialog
      open={createDialog.open}
      onClose={createDialog.onClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      PaperProps={{ sx: { maxHeight: '90vh', display: 'flex', flexDirection: 'column' } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>Создать комнату</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Команда <b>{store.selectedTeam?.name}</b> · колонки и настройки подтянутся из команды
        </Typography>
        {store.error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {store.error}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Название комнаты"
            value={createDialog.roomId}
            onChange={(event) => createDialog.onRoomId(event.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            type="password"
            label="Пароль (необязательно)"
            value={createDialog.password}
            onChange={(event) => createDialog.onPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                createDialog.onSubmit();
              }
            }}
          />
        </Box>

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          Разминка
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={createDialog.warmupKind}
          onChange={(_, value: CreateWarmupKind | null) => {
            if (value) createDialog.onWarmupKind(value);
          }}
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 700,
              py: 0.9
            }
          }}
        >
          <ToggleButton value="none">Без разминки</ToggleButton>
          <ToggleButton value="questions">Вопросы</ToggleButton>
          <ToggleButton value="charades">Шарады</ToggleButton>
        </ToggleButtonGroup>
        {createDialog.warmupKind === 'charades' && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Случайный игрок рисует или намекает слово, остальные угадывают в чате. Первый правильный ответ получает очко.
          </Typography>
        )}
        {createDialog.warmupKind === 'questions' && (
          <Box
            sx={{
              mt: 1,
              px: 1.25,
              py: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {createDialog.warmupQuestions.filter((question) => question.trim()).length > 0
                ? `Задано вопросов: ${createDialog.warmupQuestions.filter((question) => question.trim()).length}`
                : 'Нужно задать вопросы команде'}
            </Typography>
            <Button size="small" variant="outlined" onClick={createDialog.onOpenQuestions}>
              {createDialog.warmupQuestions.some((question) => question.trim()) ? 'Изменить' : 'Задать'}
            </Button>
          </Box>
        )}

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          Шаблон доски
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', minHeight: 280, flex: 1, pr: 0.5, pb: 1 }}>
          {RETRO_TEMPLATE_PICKER.map((template) => {
            const selected = createDialog.template === template.id;
            const tintColor = template.columns[0]?.color;
            return (
              <Paper
                key={template.id}
                component={ButtonBase}
                variant="outlined"
                onClick={() => createDialog.onTemplate(template.id)}
                sx={(theme) => ({
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  p: 1.25,
                  borderWidth: 2,
                  borderColor: selected ? 'primary.main' : 'transparent',
                  boxShadow: selected ? 2 : 0,
                  bgcolor: selected
                    ? 'action.selected'
                    : tintColor
                      ? COLUMN_COLOR_PRESETS[tintColor][theme.palette.mode].bg
                      : theme.palette.mode === 'dark' ? '#261d2c' : '#f3e5f5'
                })}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                  {template.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.4, lineHeight: 1.4 }}>
                  {template.description}
                </Typography>
                {template.columns.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
                    {template.columns.map((column) => column.title).join(' · ')}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={createDialog.onClose}>Отмена</Button>
        <Button
          variant="contained"
          onClick={createDialog.onSubmit}
          disabled={
            isLoading
            || !createDialog.settingsLoaded
            || !createDialog.roomId.trim()
            || (createDialog.warmupKind === 'questions' && !createDialog.warmupQuestions.some((question) => question.trim()))
          }
        >
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Создать'}
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      open={createDialog.questionsOpen}
      onClose={createDialog.onCloseQuestions}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Вопросы для разминки</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          Команда сначала ответит на эти вопросы, потом увидит ответы анонимно, и только после этого начнётся обычное ретро.
        </DialogContentText>
        {createDialog.warmupQuestions.map((question, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              autoFocus={index === 0}
              fullWidth
              label={`Вопрос ${index + 1}`}
              margin="dense"
              value={question}
              inputProps={{ maxLength: MAX_WARMUP_QUESTION_LENGTH }}
              onChange={(event) => {
                const next = [...createDialog.warmupQuestions];
                next[index] = event.target.value;
                createDialog.onWarmupQuestions(next);
              }}
            />
            <IconButton
              sx={{ mt: 1.25 }}
              aria-label="Удалить вопрос"
              disabled={createDialog.warmupQuestions.length <= 1 && !question.trim()}
              onClick={() => {
                const next = createDialog.warmupQuestions.filter((_, itemIndex) => itemIndex !== index);
                createDialog.onWarmupQuestions(next.length > 0 ? next : ['']);
              }}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Box>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() => createDialog.onWarmupQuestions([...createDialog.warmupQuestions, ''])}
          disabled={createDialog.warmupQuestions.length >= MAX_WARMUP_QUESTIONS}
          sx={{ mt: 0.5 }}
        >
          Добавить вопрос
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={createDialog.onCloseQuestions}>Готово</Button>
      </DialogActions>
    </Dialog>

    <Dialog open={joinDialog.open} onClose={joinDialog.onClose} fullWidth maxWidth="xs">
      <DialogTitle>Войти в комнату {joinDialog.roomId}</DialogTitle>
      <DialogContent>
        {joinDialog.error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {joinDialog.error}
          </Alert>
        )}
        <TextField
          autoFocus
          fullWidth
          type="password"
          label="Пароль комнаты"
          margin="normal"
          value={joinDialog.password}
          onChange={(event) => {
            joinDialog.onPassword(event.target.value);
            if (joinDialog.error) joinDialog.onClearError();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              joinDialog.onSubmit();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { joinDialog.onClose(); joinDialog.onClearError(); }}>
          Отмена
        </Button>
        <Button
          variant="contained"
          onClick={joinDialog.onSubmit}
          disabled={isLoading || !joinDialog.password.trim()}
        >
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Войти'}
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={deleteDialog.open} onClose={deleteDialog.onClose} fullWidth maxWidth="xs">
      <DialogTitle>Точное подтверждение удаления</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1.5 }}>
          Чтобы удалить комнату, введите ее ID точно как показано: <b>{deleteDialog.roomId}</b>
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label="Введите ID комнаты"
          value={deleteDialog.confirmText}
          onChange={(event) => deleteDialog.onConfirmText(event.target.value)}
          margin="normal"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={deleteDialog.onClose}>Отмена</Button>
        <Button
          color="error"
          variant="contained"
          onClick={deleteDialog.onSubmit}
          disabled={deleteDialog.busy || deleteDialog.confirmText.trim() !== deleteDialog.roomId}
        >
          {deleteDialog.busy ? <CircularProgress size={18} color="inherit" /> : 'Удалить комнату'}
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={inviteDialog.open} onClose={inviteDialog.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Приглашение в комнату {inviteDialog.roomId}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1.5 }}>
          {inviteDialog.roomHasPassword === false
            ? 'Комната без пароля — можно сразу скопировать приглашение для Telegram.'
            : 'Введите пароль комнаты, чтобы сформировать приглашение для Telegram.'}
        </DialogContentText>
        {inviteDialog.roomHasPassword !== false && (
          <TextField
            autoFocus
            fullWidth
            label="Пароль комнаты"
            margin="normal"
            value={inviteDialog.password}
            onChange={(event) => {
              inviteDialog.onPassword(event.target.value);
              if (inviteDialog.copied) inviteDialog.onClearCopied();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                inviteDialog.onCopy();
              }
            }}
          />
        )}
        {inviteDialog.message && (
          <TextField
            fullWidth
            margin="normal"
            multiline
            minRows={6}
            label="Текст приглашения (Telegram)"
            value={inviteDialog.message}
            InputProps={{ readOnly: true }}
          />
        )}
        {inviteDialog.copied && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Приглашение скопировано.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={inviteDialog.onClose}>Закрыть</Button>
        <Button variant="outlined" onClick={inviteDialog.onCopy} disabled={!inviteDialog.message}>
          Скопировать
        </Button>
        <Button
          variant="contained"
          component="a"
          href={inviteDialog.telegramLink}
          target="_blank"
          rel="noopener noreferrer"
          disabled={!inviteDialog.message}
        >
          Открыть в Telegram
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={removeDialog.open} onClose={removeDialog.onClose} fullWidth maxWidth="xs">
      <DialogTitle>Удалить участника</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Удалить <b>{removeDialog.name}</b> из команды? Этот человек больше не будет в списке участников.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={removeDialog.onClose}>Отмена</Button>
        <Button
          color="error"
          variant="contained"
          onClick={removeDialog.onSubmit}
          disabled={Boolean(removeDialog.busyName)}
        >
          {removeDialog.busyName ? <CircularProgress size={18} color="inherit" /> : 'Удалить'}
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={resetDialog.open} onClose={resetDialog.onClose} fullWidth maxWidth="xs">
      <DialogTitle>Новый пароль</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1.5 }}>
          Пароль для <b>{resetDialog.name}</b> сброшен. Передайте его участнику — старый больше не подойдёт.
        </DialogContentText>
        <TextField
          fullWidth
          label="Временный пароль"
          value={resetDialog.password}
          InputProps={{ readOnly: true }}
          margin="normal"
        />
        {resetDialog.copied && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Пароль скопирован.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={resetDialog.onClose}>Закрыть</Button>
        <Button variant="contained" onClick={resetDialog.onCopy} disabled={!resetDialog.password}>
          Скопировать
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      open={changePasswordDialog.open}
      onClose={changePasswordDialog.onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Сменить пароль команды</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>
          После смены пароля участникам нужно будет ввести его заново, чтобы войти в команду.
        </DialogContentText>
        {changePasswordDialog.error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {changePasswordDialog.error}
          </Alert>
        )}
        <TextField
          autoFocus
          fullWidth
          type="password"
          label="Новый пароль команды"
          margin="normal"
          value={changePasswordDialog.value}
          onChange={(event) => {
            changePasswordDialog.onValue(event.target.value);
            if (changePasswordDialog.error) changePasswordDialog.onClearError();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              changePasswordDialog.onSubmit();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={changePasswordDialog.onClose}>Отмена</Button>
        <Button
          variant="contained"
          onClick={changePasswordDialog.onSubmit}
          disabled={changePasswordDialog.busy || !changePasswordDialog.value.trim()}
        >
          {changePasswordDialog.busy ? <CircularProgress size={18} color="inherit" /> : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  </Box>
);

export default TeamRoomsView;
