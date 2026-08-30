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
import MicIcon from '@mui/icons-material/Mic';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AddIcon from '@mui/icons-material/Add';
import AddCardIcon from '@mui/icons-material/AddCard';
import RemoveIcon from '@mui/icons-material/Remove';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import { RetroStore } from '../store/RetroStore';
import AboutAppDialog from './AboutAppDialog';
import BackgroundImageDialog from './BackgroundImageDialog';
import { DislikeIconId, LikeIconId, MAX_VOTE_LIMIT, MIN_VOTE_LIMIT, RoomFeatures } from '../types';
import {
  DISLIKE_ICON_OPTIONS,
  LIKE_ICON_OPTIONS,
  VoteIcon
} from './VoteIcon';

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
  disabled?: boolean;
}

const FeatureToggle: React.FC<FeatureToggleProps> = ({ active, label, tooltip, icon, onClick, showTooltip, disabled = false }) => (
  <Tooltip
    title={tooltip}
    placement="top"
    enterDelay={400}
    disableHoverListener={!showTooltip}
    disableFocusListener={!showTooltip}
    disableTouchListener
  >
    <Button
      onClick={disabled ? undefined : onClick}
      variant="outlined"
      disableRipple={disabled}
      sx={{
        width: '100%',
        flexDirection: 'column',
        gap: 0.75,
        py: 1.5,
        px: 1,
        minHeight: 88,
        borderRadius: 2,
        textTransform: 'none',
        cursor: disabled ? 'default' : 'pointer',
        borderColor: active ? 'primary.main' : 'divider',
        bgcolor: active ? 'primary.main' : 'background.paper',
        color: active ? 'primary.contrastText' : 'text.secondary',
        '&:hover': {
          bgcolor: active ? (disabled ? 'primary.main' : 'primary.dark') : (disabled ? 'background.paper' : 'action.hover'),
          borderColor: active ? (disabled ? 'primary.main' : 'primary.dark') : (disabled ? 'divider' : 'text.disabled')
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
  const [isDeleteAllCardsDialogOpen, setIsDeleteAllCardsDialogOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isBackgroundDialogOpen, setIsBackgroundDialogOpen] = useState(false);
  const showTooltips = useMediaQuery('(hover: hover) and (pointer: fine)');
  const features = store.roomFeatures;
  const canEditFeatures = store.isAdmin;
  const canDeleteRoom = store.canChangePhase();

  const updateFeature = <K extends keyof RoomFeatures>(key: K, value: RoomFeatures[K]) => {
    if (!canEditFeatures) return;
    store.requestRoomFeaturesUpdate({ ...features, [key]: value });
  };

  const toggleFeature = (key: keyof Omit<RoomFeatures, 'likesPerUser' | 'dislikesPerUser' | 'likeIcon' | 'dislikeIcon'>) => {
    updateFeature(key, !features[key]);
  };

  const changeVoteLimit = (
    field: 'likesPerUser' | 'dislikesPerUser',
    delta: number,
    disabled = false
  ) => {
    if (!canEditFeatures || disabled) return;
    const next = Math.min(MAX_VOTE_LIMIT, Math.max(MIN_VOTE_LIMIT, features[field] + delta));
    if (next !== features[field]) {
      updateFeature(field, next);
    }
  };

  const renderVoteLimitRow = (
    label: string,
    field: 'likesPerUser' | 'dislikesPerUser',
    disabled = false
  ) => (
    <Box
      sx={{
        mb: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        opacity: disabled ? 0.5 : 1
      }}
    >
      <Typography
        sx={{
          minWidth: 36,
          fontWeight: 700,
          fontSize: '1.25rem',
          lineHeight: 1,
          textAlign: 'center'
        }}
      >
        {features[field]}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <IconButton
        size="small"
        aria-label={`Уменьшить: ${label}`}
        disabled={!canEditFeatures || disabled || features[field] <= MIN_VOTE_LIMIT}
        onClick={() => changeVoteLimit(field, -1, disabled)}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        aria-label={`Увеличить: ${label}`}
        disabled={!canEditFeatures || disabled || features[field] >= MAX_VOTE_LIMIT}
        onClick={() => changeVoteLimit(field, 1, disabled)}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  const renderIconPickerRow = <T extends LikeIconId | DislikeIconId,>(
    label: string,
    type: 'like' | 'dislike',
    options: { id: T; label: string }[],
    selected: T,
    onSelect: (id: T) => void,
    disabled = false
  ) => (
    <Box
      sx={{
        mb: 1.5,
        opacity: disabled ? 0.5 : 1
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {options.map((option) => {
          const isSelected = option.id === selected;
          return (
            <Tooltip
              key={option.id}
              title={option.label}
              placement="top"
              enterDelay={400}
              disableHoverListener={!showTooltips}
              disableFocusListener={!showTooltips}
              disableTouchListener
            >
              <span>
                <IconButton
                  size="small"
                  aria-label={option.label}
                  aria-pressed={isSelected}
                  disabled={!canEditFeatures || disabled}
                  onClick={() => onSelect(option.id)}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected ? 'action.selected' : 'background.paper',
                    '&:hover': {
                      bgcolor: disabled ? 'background.paper' : 'action.hover'
                    }
                  }}
                >
                  <VoteIcon type={type} id={option.id} size={24} />
                </IconButton>
              </span>
            </Tooltip>
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
              <FeatureToggle
                active={Boolean(features.backgroundImage)}
                label="Фон"
                tooltip={
                  !canEditFeatures
                    ? 'Только администратор может менять фон доски'
                    : features.backgroundImage
                      ? 'Изменить или убрать фоновое изображение. Фон видят все участники'
                      : 'Добавить фоновое изображение доски. Фон видят все участники'
                }
                icon={<WallpaperIcon fontSize="inherit" />}
                onClick={() => setIsBackgroundDialogOpen(true)}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.membersCanAddCards}
                label="А давайте"
                tooltip={
                  features.membersCanAddCards
                    ? 'Участники могут добавлять карточки в колонку «А давайте!». Нажмите, чтобы разрешить добавление только администратору. Комментарии и реакции остаются доступны всем'
                    : 'Только администратор может добавлять карточки в колонку «А давайте!». Комментарии и реакции доступны всем. Нажмите, чтобы разрешить добавление участникам'
                }
                icon={<AddCardIcon fontSize="inherit" />}
                onClick={() => toggleFeature('membersCanAddCards')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
            </Box>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Включенные функции
            </Typography>

            {!canEditFeatures && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Только администратор может менять настройки функций.
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
                onClick={() => toggleFeature('mediaEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.reactionsEnabled}
                label="Реакции"
                tooltip="Разрешить эмодзи-реакции на карточках"
                icon={<FavoriteIcon fontSize="inherit" />}
                onClick={() => toggleFeature('reactionsEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.commentsEnabled}
                label="Комментарии"
                tooltip="Разрешить комментарии к карточкам"
                icon={<ChatBubbleOutlineIcon fontSize="inherit" />}
                onClick={() => toggleFeature('commentsEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.moveCardsEnabled}
                label="Перемещение"
                tooltip="Разрешить участникам перетаскивать свои карточки между колонками. Администратор может перетаскивать любые карточки всегда"
                icon={<OpenWithIcon fontSize="inherit" />}
                onClick={() => toggleFeature('moveCardsEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.anonymousEnabled}
                label="Аноним"
                tooltip="Скрыть имена авторов на карточках"
                icon={<PersonIcon fontSize="inherit" />}
                onClick={() => toggleFeature('anonymousEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.hideCardTextDuringCreation}
                label="Скрытие"
                tooltip="Скрывать текст чужих карточек на этапе создания (админ видит все)"
                icon={<VisibilityOffIcon fontSize="inherit" />}
                onClick={() => toggleFeature('hideCardTextDuringCreation')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.dislikesEnabled}
                label="Дизлайки"
                tooltip="Разрешить дизлайки при голосовании"
                icon={<VoteIcon type="dislike" id={features.dislikeIcon} size={28} />}
                onClick={() => toggleFeature('dislikesEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.musicEnabled}
                label="Музыка"
                tooltip="Включить фоновую музыку и таймер"
                icon={<MusicNoteIcon fontSize="inherit" />}
                onClick={() => toggleFeature('musicEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.retroRatingEnabled}
                label="Оценка ретро"
                tooltip="Добавить этап оценки ретроспективы"
                icon={<StarRateIcon fontSize="inherit" />}
                onClick={() => toggleFeature('retroRatingEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.sprintVipEnabled}
                label="VIP спринта"
                tooltip="Голосование за VIP участника спринта"
                icon={<EmojiEventsIcon fontSize="inherit" />}
                onClick={() => toggleFeature('sprintVipEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.drawingEnabled}
                label="Рисование"
                tooltip="Разрешить рисование на доске"
                icon={<BrushIcon fontSize="inherit" />}
                onClick={() => toggleFeature('drawingEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.cardEditingEnabled}
                label="Правка"
                tooltip="Разрешить редактирование и удаление карточек"
                icon={<EditIcon fontSize="inherit" />}
                onClick={() => toggleFeature('cardEditingEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.chatEnabled}
                label="Чат"
                tooltip="Показать чат комнаты"
                icon={<ChatIcon fontSize="inherit" />}
                onClick={() => toggleFeature('chatEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.readyEnabled}
                label="Готовность"
                tooltip="Показывать статус готовности участников"
                icon={<CheckCircleOutlineIcon fontSize="inherit" />}
                onClick={() => toggleFeature('readyEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
              <FeatureToggle
                active={features.facilitatorEnabled}
                label="Ведущий"
                tooltip="Случайно выбрать ведущего на этапе обсуждения"
                icon={<MicIcon fontSize="inherit" />}
                onClick={() => toggleFeature('facilitatorEnabled')}
                showTooltip={showTooltips}
                disabled={!canEditFeatures}
              />
            </Box>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Голосование за карточки
            </Typography>
            {renderVoteLimitRow('Макс. кол-во лайков', 'likesPerUser')}
            {renderVoteLimitRow('Макс. кол-во дизлайков', 'dislikesPerUser', !features.dislikesEnabled)}
            {renderIconPickerRow(
              'Иконка лайков',
              'like',
              LIKE_ICON_OPTIONS,
              features.likeIcon,
              (id) => updateFeature('likeIcon', id)
            )}
            {renderIconPickerRow(
              'Иконка дизлайков',
              'dislike',
              DISLIKE_ICON_OPTIONS,
              features.dislikeIcon,
              (id) => updateFeature('dislikeIcon', id),
              !features.dislikesEnabled
            )}

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
              {store.isAdmin && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteSweepIcon />}
                  disabled={store.cards.length === 0}
                  onClick={() => setIsDeleteAllCardsDialogOpen(true)}
                >
                  Удалить все карточки
                </Button>
              )}
              {canDeleteRoom && (
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
              <Button
                fullWidth
                variant="text"
                color="inherit"
                startIcon={<InfoOutlinedIcon />}
                onClick={() => setIsAboutOpen(true)}
                aria-label="О приложении"
                sx={{ mt: 1, color: 'text.secondary' }}
              >
                О приложении
              </Button>
            </Box>
          </Box>
        </Box>
      </Drawer>

      <Dialog open={isDeleteAllCardsDialogOpen} onClose={() => setIsDeleteAllCardsDialogOpen(false)}>
        <DialogTitle>Удалить все карточки?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы точно хотите удалить все карточки? Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteAllCardsDialogOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setIsDeleteAllCardsDialogOpen(false);
              store.socketService?.deleteAllCards();
            }}
          >
            Удалить все
          </Button>
        </DialogActions>
      </Dialog>

      <AboutAppDialog open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <BackgroundImageDialog
        open={isBackgroundDialogOpen}
        currentValue={features.backgroundImage}
        onClose={() => setIsBackgroundDialogOpen(false)}
        onSave={(value) => store.requestRoomBackgroundUpdate(value)}
      />

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
