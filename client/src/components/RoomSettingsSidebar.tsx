import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import StarRateIcon from '@mui/icons-material/StarRate';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BrushIcon from '@mui/icons-material/Brush';
import EditIcon from '@mui/icons-material/Edit';
import ChatIcon from '@mui/icons-material/Chat';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { RetroStore } from '../store/RetroStore';
import { RoomFeatures, VoteLimit } from '../types';

interface Props {
  store: RetroStore;
  open: boolean;
  onClose: () => void;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  isUserListVisible: boolean;
  onToggleUserList: () => void;
}

interface FeatureToggleProps {
  active: boolean;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  onClick: () => void;
  showTooltip: boolean;
}

const FeatureToggle: React.FC<FeatureToggleProps> = ({ active, label, tooltip, icon, onClick, showTooltip }) => (
  <Tooltip
    title={tooltip}
    placement="top"
    enterDelay={400}
    disableHoverListener={!showTooltip}
    disableFocusListener={!showTooltip}
    disableTouchListener
  >
    <Button
      onClick={onClick}
      variant="outlined"
      sx={{
        width: '100%',
        flexDirection: 'column',
        gap: 0.75,
        py: 1.5,
        px: 1,
        minHeight: 88,
        borderRadius: 2,
        textTransform: 'none',
        borderColor: active ? 'primary.main' : 'divider',
        bgcolor: active ? 'primary.main' : 'background.paper',
        color: active ? 'primary.contrastText' : 'text.secondary',
        '&:hover': {
          bgcolor: active ? 'primary.dark' : 'action.hover',
          borderColor: active ? 'primary.dark' : 'text.disabled'
        }
      }}
    >
      <Box sx={{ fontSize: 28, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </Box>
      <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.2, color: 'inherit' }}>
        {label}
      </Typography>
    </Button>
  </Tooltip>
);

const RoomSettingsSidebar: React.FC<Props> = observer(({ store, open, onClose, themeMode, onToggleTheme, isUserListVisible, onToggleUserList }) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const showTooltips = useMediaQuery('(hover: hover) and (pointer: fine)');
  const features = store.roomFeatures;
  const canManage = store.canChangePhase();

  const updateFeature = <K extends keyof RoomFeatures>(key: K, value: RoomFeatures[K]) => {
    store.requestRoomFeaturesUpdate({ ...features, [key]: value });
  };

  const toggleFeature = (key: keyof Omit<RoomFeatures, 'likesPerUser' | 'dislikesPerUser'>) => {
    updateFeature(key, !features[key]);
  };

  const voteOptions: VoteLimit[] = [1, 3, 5];

  const renderVoteLimitRow = (
    label: string,
    emoji: string,
    field: 'likesPerUser' | 'dislikesPerUser',
    disabled = false
  ) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Лимит на участника в фазе голосования
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {voteOptions.map((count) => {
          const active = features[field] === count;
          return (
            <Button
              key={count}
              variant="outlined"
              disabled={!canManage || disabled}
              onClick={() => canManage && !disabled && updateFeature(field, count)}
              sx={{
                flex: 1,
                minHeight: 56,
                borderRadius: 2,
                fontSize: '1.1rem',
                fontWeight: 700,
                borderColor: active ? 'primary.main' : 'divider',
                bgcolor: active ? 'primary.main' : 'background.paper',
                color: active ? 'primary.contrastText' : 'text.secondary',
                '&:hover': {
                  bgcolor: active ? 'primary.dark' : 'action.hover'
                }
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                <Typography component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }}>
                  {emoji}
                </Typography>
                <Typography component="span" sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>
                  {count}
                </Typography>
              </Box>
            </Button>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 340 },
            maxWidth: '100vw'
          }
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Настройки
            </Typography>
            <IconButton onClick={onClose} aria-label="Закрыть настройки">
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Интерфейс
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
                mb: 2
              }}
            >
              <FeatureToggle
                active={themeMode === 'dark'}
                label="Тема"
                tooltip={themeMode === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
                icon={themeMode === 'dark' ? <LightModeIcon fontSize="inherit" /> : <DarkModeIcon fontSize="inherit" />}
                onClick={onToggleTheme}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={isUserListVisible}
                label="Участники"
                tooltip={isUserListVisible ? 'Скрыть список участников' : 'Показать список участников'}
                icon={<PeopleIcon fontSize="inherit" />}
                onClick={onToggleUserList}
                showTooltip={showTooltips}
              />
            </Box>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Включенные функции
            </Typography>

            {!canManage && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Только администратор может менять настройки.
              </Typography>
            )}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
                mb: 2
              }}
            >
              <FeatureToggle
                active={features.mediaEnabled}
                label="Медиа"
                tooltip="Разрешить изображения на карточках"
                icon={<ImageIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('mediaEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.reactionsEnabled}
                label="Реакции"
                tooltip="Разрешить эмодзи-реакции на карточках"
                icon={<FavoriteIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('reactionsEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.commentsEnabled}
                label="Комментарии"
                tooltip="Разрешить комментарии к карточкам"
                icon={<ChatBubbleOutlineIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('commentsEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.moveCardsEnabled}
                label="Перемещение"
                tooltip="Разрешить перетаскивание карточек между колонками"
                icon={<OpenWithIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('moveCardsEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.anonymousEnabled}
                label="Аноним"
                tooltip="Скрыть имена авторов на карточках"
                icon={<PersonIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('anonymousEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.hideCardTextDuringCreation}
                label="Скрытие"
                tooltip="Скрывать текст чужих карточек на этапе создания (админ видит все)"
                icon={<VisibilityOffIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('hideCardTextDuringCreation')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.dislikesEnabled}
                label="Дизлайки"
                tooltip="Разрешить дизлайки при голосовании"
                icon={<Typography component="span" sx={{ fontSize: 26, lineHeight: 1 }}>🍅</Typography>}
                onClick={() => canManage && toggleFeature('dislikesEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.musicEnabled}
                label="Музыка"
                tooltip="Включить фоновую музыку и таймер"
                icon={<MusicNoteIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('musicEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.retroRatingEnabled}
                label="Оценка ретро"
                tooltip="Добавить этап оценки ретроспективы"
                icon={<StarRateIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('retroRatingEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.sprintVipEnabled}
                label="VIP спринта"
                tooltip="Голосование за VIP участника спринта"
                icon={<EmojiEventsIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('sprintVipEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.drawingEnabled}
                label="Рисование"
                tooltip="Разрешить рисование на доске"
                icon={<BrushIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('drawingEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.cardEditingEnabled}
                label="Правка"
                tooltip="Разрешить редактирование и удаление карточек"
                icon={<EditIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('cardEditingEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.chatEnabled}
                label="Чат"
                tooltip="Показать чат комнаты"
                icon={<ChatIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('chatEnabled')}
                showTooltip={showTooltips}
              />
              <FeatureToggle
                active={features.readyEnabled}
                label="Готовность"
                tooltip="Показывать статус готовности участников"
                icon={<CheckCircleOutlineIcon fontSize="inherit" />}
                onClick={() => canManage && toggleFeature('readyEnabled')}
                showTooltip={showTooltips}
              />
            </Box>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Голосование за карточки
            </Typography>
            {renderVoteLimitRow('Лайки', '🍑', 'likesPerUser')}
            {renderVoteLimitRow('Дизлайки', '🍅', 'dislikesPerUser', !features.dislikesEnabled)}

            <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ExitToAppIcon />}
                onClick={() => {
                  onClose();
                  store.socketService?.leaveRoom();
                }}
              >
                Выйти из комнаты
              </Button>
              {canManage && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteForeverIcon />}
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  Удалить комнату
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Drawer>

      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Удалить комнату?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Комната будет удалена безвозвратно для всех участников.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Отмена</Button>
          <Button
            color="error"
            onClick={() => {
              setIsDeleteDialogOpen(false);
              onClose();
              store.socketService?.deleteRoom();
            }}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

export default RoomSettingsSidebar;
