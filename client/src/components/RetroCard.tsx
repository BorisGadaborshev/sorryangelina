import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Card as CardType, CARD_REACTION_EMOJIS, cardTextToEditorValue, editorValueToCardText, getCardTextSegments, getColumnColorStyles } from '../types';
import { Card, CardContent, Typography, IconButton, TextField, Box, Tooltip, Alert, Button, Menu, MenuItem, ListItemIcon, ListItemText, Popover, Divider } from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import MoreVert from '@mui/icons-material/MoreVert';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import AddReaction from '@mui/icons-material/AddReaction';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useTheme } from '@mui/material/styles';
import { ARKANOID_HITS_TO_BREAK, RetroStore } from '../store/RetroStore';
import { getDislikeIconLabel, getLikeIconLabel, VoteIcon } from './VoteIcon';
import { fileToImageDataUrl, IMAGE_FILE_ACCEPT, safeMediaSrc } from '../utils/media';

interface Props {
  card: CardType;
  index: number;
  store: RetroStore;
  isMergeDropTarget?: boolean;
}

const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн. назад`;
};

const formatCommentAuthorName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName.trim();
  const [surname, ...rest] = parts;
  const initials = rest
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .map((letter) => `${letter.toUpperCase()}.`)
    .join('');
  return initials ? `${surname} ${initials}` : surname;
};

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

const RetroCard: React.FC<Props> = observer(({ card, index, store, isMergeDropTarget = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [imageUrl, setImageUrl] = useState(card.imageUrl || '');
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imagePickError, setImagePickError] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [reactionAnchorEl, setReactionAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMenuOpen = Boolean(menuAnchorEl);
  const isReactionPickerOpen = Boolean(reactionAnchorEl);

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

  const handleVote = (voteType: 'like' | 'dislike') => {
    if (store.phase === 'voting' && store.socket) {
      store.socketService?.voteCard(card.id, voteType);
    }
  };

  const handleSubmitComment = () => {
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    store.socketService?.addCardComment(card.id, trimmed);
    setCommentDraft('');
    setShowCommentInput(false);
  };

  const handleStartEditComment = (commentId: string, text: string) => {
    setEditingCommentId(commentId);
    setEditingCommentDraft(text);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentDraft('');
  };

  const handleSaveComment = () => {
    const trimmed = editingCommentDraft.trim();
    if (!trimmed || !editingCommentId) return;
    store.socketService?.updateCardComment(card.id, editingCommentId, trimmed);
    handleCancelEditComment();
  };

  const handleToggleReaction = (emoji: string) => {
    store.socketService?.toggleCardReaction(card.id, emoji);
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
  const currentUserId = store.currentUser?.id || '';
  const isTextHidden = store.isCardTextHidden(card);
  const hasLiked = card.likes?.includes(currentUserId) || false;
  const hasDisliked = card.dislikes?.includes(currentUserId) || false;
  const canEdit = store.canEditCard(card);
  const canUseSocial = store.canUseCardSocial(card);
  const showReactions = features.reactionsEnabled;
  const showComments = features.commentsEnabled;
  const showDislikes = features.dislikesEnabled;
  const showAuthorClaim = Boolean(card.authorRevealed && card.createdBy);
  const showAuthor = !showAuthorClaim && !features.anonymousEnabled && Boolean(card.createdBy);
  const comments = card.comments || [];
  const commentCount = comments.length;

  const groupedReactions = useMemo(() => {
    const groups = new Map<string, { emoji: string; count: number; reactedByMe: boolean }>();
    (card.reactions || []).forEach((reaction) => {
      const existing = groups.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, reactedByMe: false };
      existing.count += 1;
      if (reaction.userId === currentUserId) {
        existing.reactedByMe = true;
      }
      groups.set(reaction.emoji, existing);
    });
    return Array.from(groups.values());
  }, [card.reactions, currentUserId]);

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

            {showReactions && canUseSocial && groupedReactions.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {groupedReactions.map((group) => (
                  <Box
                    key={group.emoji}
                    onClick={() => handleToggleReaction(group.emoji)}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 999,
                      cursor: 'pointer',
                      bgcolor: group.reactedByMe ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.08)',
                      border: '1px solid',
                      borderColor: group.reactedByMe ? 'primary.main' : 'transparent'
                    }}
                  >
                    <Typography component="span" sx={{ fontSize: '0.95rem', lineHeight: 1 }}>
                      {group.emoji}
                    </Typography>
                    <Typography variant="caption">{group.count}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            {canUseSocial && comments.map((comment) => {
              const authorShortName = formatCommentAuthorName(comment.userName || '');
              const canEditComment = showComments && comment.userId === currentUserId;
              const isEditingComment = editingCommentId === comment.id;
              return (
              <Box key={comment.id} sx={{ mt: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    minWidth: 0
                  }}
                >
                  {authorShortName && (
                    <Tooltip title={comment.userName} placement="top">
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          lineHeight: 1.3,
                          minWidth: 0,
                          maxWidth: '58%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.55)'
                        }}
                      >
                        {authorShortName}
                      </Typography>
                    </Tooltip>
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      flexShrink: 0,
                      color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.38)'
                    }}
                  >
                    {comment.updatedAt ? 'изменено' : formatRelativeTime(comment.createdAt)}
                  </Typography>
                  {canEditComment && !isEditingComment && (
                    <Tooltip title="Редактировать комментарий">
                      <IconButton
                        size="small"
                        onClick={() => handleStartEditComment(comment.id, comment.text)}
                        sx={{ ml: 'auto', width: 22, height: 22 }}
                      >
                        <Edit sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                {isEditingComment ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <TextField
                      size="small"
                      value={editingCommentDraft}
                      onChange={(event) => setEditingCommentDraft(event.target.value)}
                      fullWidth
                      multiline
                      maxRows={3}
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          handleCancelEditComment();
                        }
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleSaveComment();
                        }
                      }}
                    />
                    <IconButton size="small" onClick={handleCancelEditComment}>
                      <Close fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="primary" onClick={handleSaveComment} disabled={!editingCommentDraft.trim()}>
                      <Check fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                <Typography
                  variant="body2"
                  sx={{
                    wordBreak: 'break-word',
                    fontStyle: 'italic',
                    fontSize: '0.8rem',
                    color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.5)'
                  }}
                >
                  {comment.text}
                </Typography>
                )}
              </Box>
              );
            })}

            {showComments && canUseSocial && showCommentInput && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 1,
                  p: 0.5,
                  borderRadius: 1,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.08)'
                }}
              >
                <TextField
                  size="small"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Введите комментарий..."
                  fullWidth
                  multiline
                  maxRows={3}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                />
                <IconButton size="small" color="primary" onClick={handleSubmitComment} disabled={!commentDraft.trim()}>
                  <Check fontSize="small" />
                </IconButton>
              </Box>
            )}

            {(store.phase === 'voting' || store.phase === 'discussion') && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title={getLikeIconLabel(features.likeIcon)}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleVote('like')}
                        color={hasLiked ? 'primary' : 'default'}
                        disabled={store.phase !== 'voting'}
                      >
                        <VoteIcon type="like" id={features.likeIcon} size={18} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Typography variant="body2" sx={{ ml: 0.5 }}>
                    {card.likes?.length || 0}
                  </Typography>
                </Box>
                {showDislikes && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title={getDislikeIconLabel(features.dislikeIcon)}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleVote('dislike')}
                        color={hasDisliked ? 'error' : 'default'}
                        disabled={store.phase !== 'voting'}
                      >
                        <VoteIcon type="dislike" id={features.dislikeIcon} size={18} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Typography variant="body2" sx={{ ml: 0.5 }}>
                    {card.dislikes?.length || 0}
                  </Typography>
                </Box>
                )}
                {store.phase === 'discussion' && (
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                    Рейтинг: {(card.likes?.length || 0) - (card.dislikes?.length || 0)}
                  </Typography>
                )}
              </Box>
            )}

            {store.voteError?.cardId === card.id && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {store.voteError.message}
              </Alert>
            )}

            {canUseSocial && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 1,
                  pt: 0.5
                }}
              >
                {showReactions && (
                <IconButton
                  size="small"
                  onClick={(event) => setReactionAnchorEl(event.currentTarget)}
                  sx={{
                    color: theme.palette.text.secondary,
                    width: 28,
                    height: 28,
                    bgcolor: cardColor,
                    '&:hover': {
                      bgcolor: cardColor,
                      color: theme.palette.text.secondary,
                      filter: theme.palette.mode === 'dark' ? 'brightness(1.15)' : 'brightness(0.94)'
                    }
                  }}
                >
                  <AddReaction sx={{ fontSize: 18 }} />
                </IconButton>
                )}
                {showComments && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <IconButton
                    size="small"
                    onClick={() => setShowCommentInput((value) => !value)}
                    sx={{
                      color: 'inherit',
                      width: 28,
                      height: 28,
                      bgcolor: cardColor,
                      '&:hover': {
                        bgcolor: cardColor,
                        filter: theme.palette.mode === 'dark' ? 'brightness(1.15)' : 'brightness(0.94)'
                      }
                    }}
                  >
                    <ChatBubbleOutline sx={{ fontSize: 16 }} />
                  </IconButton>
                  <Typography variant="caption" sx={{ opacity: 0.85, minWidth: 12 }}>
                    {commentCount}
                  </Typography>
                </Box>
                )}
              </Box>
            )}
          </>
        )}
      </CardContent>

      {showReactions && canUseSocial && !isEditing && (
        <Popover
            open={isReactionPickerOpen}
            anchorEl={reactionAnchorEl}
            onClose={() => setReactionAnchorEl(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0.5,
                p: 1,
                width: 156
              }}
            >
              {CARD_REACTION_EMOJIS.map((emoji) => {
                const reactedByMe = (card.reactions || []).some(
                  (reaction) => reaction.emoji === emoji && reaction.userId === currentUserId
                );
                return (
                  <IconButton
                    key={emoji}
                    size="small"
                    onClick={() => {
                      handleToggleReaction(emoji);
                      setReactionAnchorEl(null);
                    }}
                    sx={{
                      fontSize: '1.2rem',
                      bgcolor: reactedByMe ? 'action.selected' : 'transparent'
                    }}
                  >
                    {emoji}
                  </IconButton>
                );
              })}
            </Box>
          </Popover>
      )}
    </Card>
  );
});

export default RetroCard;
