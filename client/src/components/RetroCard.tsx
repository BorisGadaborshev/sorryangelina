import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Card as CardType, cardTextToEditorValue, editorValueToCardText, getCardTextSegments, getColumnColorStyles } from '../types';
import { Card, CardContent, Typography, IconButton, TextField, Box, Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import CallSplit from '@mui/icons-material/CallSplit';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import MoreVert from '@mui/icons-material/MoreVert';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useTheme } from '@mui/material/styles';
import { ARKANOID_HITS_TO_BREAK, RetroStore } from '../store/RetroStore';
import { fileToImageDataUrl, IMAGE_FILE_ACCEPT, safeMediaSrc } from '../utils/media';
import CardSocial from './CardSocial';

interface Props {
  card: CardType;
  index: number;
  store: RetroStore;
  isMergeDropTarget?: boolean;
}

const ArkanoidCardFx = observer(({ store, cardId }: { store: RetroStore; cardId: string }) => {
  if (!store.arkanoidActive) return null;
  const hits = store.arkanoidHits.get(cardId) || 0;
  if (hits <= 0) return null;
  const broken = hits >= ARKANOID_HITS_TO_BREAK;
  return (
    <>
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          opacity: broken ? 0.42 : 1,
          outline: broken ? '2px dashed rgba(90, 90, 90, 0.85)' : '2px solid rgba(225, 29, 72, 0.8)',
          outlineOffset: -2,
          filter: broken ? 'grayscale(0.75)' : undefined
        }}
      />
      <ArkanoidCracks hits={hits} />
      {!broken && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            zIndex: 3,
            display: 'flex',
            gap: '3px',
            pointerEvents: 'none'
          }}
        >
          {Array.from({ length: ARKANOID_HITS_TO_BREAK }, (_, pip) => (
            <Box
              key={pip}
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: pip < hits ? '#e11d48' : 'rgba(0,0,0,0.16)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.75)'
              }}
            />
          ))}
        </Box>
      )}
    </>
  );
});

const ArkanoidCracks: React.FC<{ hits: number }> = ({ hits }) => {
  if (hits <= 0) return null;
  const ink = 'rgba(28, 18, 18, 0.78)';
  const light = 'rgba(255,255,255,0.8)';
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M8 18 L42 46 L22 88" stroke={light} strokeWidth="2.4" fill="none" />
        <path d="M8 18 L42 46 L22 88" stroke={ink} strokeWidth="1.05" fill="none" />
        {hits >= 2 && (
          <>
            <path d="M78 6 L52 44 L92 72" stroke={light} strokeWidth="2.4" fill="none" />
            <path d="M78 6 L52 44 L92 72" stroke={ink} strokeWidth="1.05" fill="none" />
          </>
        )}
        {hits >= ARKANOID_HITS_TO_BREAK && (
          <>
            <path d="M16 64 L58 36 L96 94" stroke={light} strokeWidth="2.6" fill="none" />
            <path d="M16 64 L58 36 L96 94" stroke={ink} strokeWidth="1.15" fill="none" />
            <path d="M42 46 L72 24" stroke={ink} strokeWidth="1" fill="none" />
          </>
        )}
      </svg>
    </Box>
  );
};

const CardBodyText: React.FC<{ text: string; variant?: 'body1' | 'body2' }> = ({ text, variant = 'body1' }) => {
  const theme = useTheme();
  const segments = getCardTextSegments(text);

  return (
    <Box>
      {segments.map((segment, index) => (
        <React.Fragment key={`${index}-${segment.slice(0, 24)}`}>
          {index > 0 && (
            <Divider
              sx={{
                my: 1,
                borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'
              }}
            />
          )}
          <Typography variant={variant} sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', minWidth: 0 }}>
            {segment}
          </Typography>
        </React.Fragment>
      ))}
    </Box>
  );
};

const RetroCard: React.FC<Props> = observer(({ card, store, isMergeDropTarget = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [imageUrl, setImageUrl] = useState(card.imageUrl || '');
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imagePickError, setImagePickError] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMenuOpen = Boolean(menuAnchorEl);

  useEffect(() => {
    setImageLoadError(false);
  }, [card.imageUrl]);

  const handleEdit = () => {
    if (store.canEditCard(card) && (store.phase === 'creation' || store.phase === 'discussion' || store.phase === 'roadmap')) {
      setText(cardTextToEditorValue(card.text));
      setImageUrl(card.imageUrl || '');
      setImagePickError('');
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    const nextText = editorValueToCardText(text);
    if (nextText && store.socket && (store.phase === 'creation' || store.phase === 'discussion' || store.phase === 'roadmap') && store.canEditCard(card)) {
      store.socketService?.updateCard(card.id, nextText, imageUrl.trim() || undefined);
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    if (store.canEditCard(card) && store.socket && (store.phase === 'creation' || store.phase === 'discussion' || store.phase === 'roadmap')) {
      store.socket.emit('delete-card', { cardId: card.id });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleEditFromMenu = () => {
    handleMenuClose();
    handleEdit();
  };

  const handleDeleteFromMenu = () => {
    handleMenuClose();
    handleDelete();
  };

  const handleUnmerge = (event: React.MouseEvent) => {
    event.stopPropagation();
    store.socketService?.unmergeCard(card.id);
  };

  const handleSelectImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await fileToImageDataUrl(file);
      setImageUrl(dataUrl);
      setImagePickError('');
    } catch (error) {
      setImagePickError(error instanceof Error ? error.message : 'Не удалось загрузить изображение');
    }
  };

  const cardColor = getColumnColorStyles(store.getColumnColor(card.column), theme.palette.mode).fill;

  const features = store.roomFeatures;
  const isEditingAllowed = (
    store.phase === 'creation'
    || store.phase === 'roadmap'
    || (store.phase === 'discussion' && store.canEditCard(card))
  );
  const originColumn = card.originColumn;
  const originDefinition = originColumn != null ? store.templateConfig.columns[originColumn] : undefined;
  const showOriginBadge = originDefinition != null && card.column >= store.templateConfig.columns.length;
  const originAccent = showOriginBadge
    ? getColumnColorStyles(store.getColumnColor(originColumn as number), theme.palette.mode).accent
    : undefined;
  const isTextHidden = store.isCardTextHidden(card);
  const canUnmerge = store.canMergeCards && !isTextHidden && getCardTextSegments(card.text).length > 1;
  const canEdit = store.canEditCard(card);
  const showAuthorClaim = Boolean(card.authorRevealed && card.createdBy);
  const showAuthor = !showAuthorClaim && !features.anonymousEnabled && Boolean(card.createdBy);

  return (
    <Card
      data-arkanoid-card={card.id}
      sx={{
        margin: 0.6,
        width: 'auto',
        maxWidth: '100%',
        minWidth: 0,
        backgroundColor: cardColor,
        color: cardColor && theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.92)' : 'inherit',
        position: 'relative',
        overflow: 'hidden',
        outline: isMergeDropTarget
          ? `3px solid ${theme.palette.primary.main}`
          : '3px solid transparent',
        outlineOffset: -2,
        transition: 'outline-color 0.15s ease'
      }}
    >
      <ArkanoidCardFx store={store} cardId={card.id} />
      <CardContent sx={{ pb: '4px !important', '&:last-child': { pb: '4px' } }}>
        {showOriginBadge && originDefinition && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 0.75,
              px: 0.75,
              py: 0.15,
              borderRadius: 999,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: originAccent,
              color: originAccent,
              fontSize: '0.7rem',
              fontWeight: 700,
              lineHeight: 1.4
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: originAccent }} />
            {originDefinition.title}
          </Box>
        )}
        {isEditing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              multiline
              value={text}
              onChange={(e) => setText(e.target.value)}
              variant="outlined"
              size="small"
            />
            {features.mediaEnabled && (
              <>
                <TextField
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  variant="outlined"
                  size="small"
                  placeholder="Ссылка на изображение"
                />
                <Button component="label" size="small" variant="outlined">
                  Загрузить файл
                  <input hidden type="file" accept={IMAGE_FILE_ACCEPT} onChange={handleSelectImageFile} />
                </Button>
                {imagePickError && (
                  <Typography variant="caption" color="error">
                    {imagePickError}
                  </Typography>
                )}
                {safeMediaSrc(imageUrl) && (
                  <Box
                    component="img"
                    src={safeMediaSrc(imageUrl)}
                    alt="preview"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 220,
                      objectFit: 'contain',
                      borderRadius: 1,
                      border: '1px solid rgba(0,0,0,0.1)'
                    }}
                  />
                )}
              </>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <IconButton size="small" onClick={() => setIsEditing(false)}>
                Отмена
              </IconButton>
              <IconButton size="small" onClick={handleSave} color="primary">
                Сохранить
              </IconButton>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {isTextHidden ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      opacity: 0.55,
                      minHeight: 24
                    }}
                  >
                    <VisibilityOff sx={{ fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      Текст скрыт
                    </Typography>
                  </Box>
                ) : (
                  <CardBodyText text={card.text} />
                )}
                {canUnmerge && (
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<CallSplit sx={{ fontSize: 16 }} />}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={handleUnmerge}
                    sx={{
                      mt: 0.75,
                      px: 0.75,
                      py: 0.25,
                      minWidth: 0,
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      opacity: 0.85
                    }}
                  >
                    Отменить объединение
                  </Button>
                )}
                {showAuthorClaim && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'inline-flex',
                      mt: 0.75,
                      px: 0.9,
                      py: 0.25,
                      borderRadius: 999,
                      fontWeight: 700,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)'
                    }}
                  >
                    Автор: {card.createdBy}
                  </Typography>
                )}
                {showAuthor && (
                  <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
                    {card.createdBy}
                  </Typography>
                )}
              </Box>
              {canEdit && isEditingAllowed && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: -0.5, mr: -0.5, flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    onClick={handleMenuOpen}
                    aria-label="Действия с карточкой"
                  >
                    <MoreVert fontSize="small" />
                  </IconButton>
                  <Menu
                    anchorEl={menuAnchorEl}
                    open={isMenuOpen}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <MenuItem onClick={handleEditFromMenu}>
                      <ListItemIcon>
                        <Edit fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Редактировать</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleDeleteFromMenu}>
                      <ListItemIcon>
                        <Delete fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Удалить</ListItemText>
                    </MenuItem>
                  </Menu>
                </Box>
              )}
            </Box>

            <Divider
              sx={{
                my: 1,
                borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'
              }}
            />

            {features.mediaEnabled && !isTextHidden && safeMediaSrc(card.imageUrl) && !imageLoadError && (
              <Box
                component="img"
                src={safeMediaSrc(card.imageUrl)}
                alt="card"
                onError={() => setImageLoadError(true)}
                sx={{
                  mt: 1,
                  width: '100%',
                  maxWidth: '100%',
                  maxHeight: 260,
                  objectFit: 'contain',
                  borderRadius: 1
                }}
              />
            )}
            {features.mediaEnabled && !isTextHidden && safeMediaSrc(card.imageUrl) && imageLoadError && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                Не удалось загрузить изображение по этой ссылке
              </Typography>
            )}

            <CardSocial store={store} card={card} />
          </>
        )}
      </CardContent>

    </Card>
  );
});

export default RetroCard;
