import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Card as CardType, CARD_REACTION_EMOJIS } from '../types';
import { Card, CardContent, Typography, IconButton, TextField, Box, Tooltip, Alert, Button, Menu, MenuItem, ListItemIcon, ListItemText, Popover, Divider } from '@mui/material';
import { Delete, Edit, MoreVert, Check, ChatBubbleOutline, AddReaction } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { RetroStore } from '../store/RetroStore';

interface Props {
  card: CardType;
  index: number;
  store: RetroStore;
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

const RetroCard: React.FC<Props> = observer(({ card, index, store }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [imageUrl, setImageUrl] = useState(card.imageUrl || '');
  const [imageLoadError, setImageLoadError] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [reactionAnchorEl, setReactionAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMenuOpen = Boolean(menuAnchorEl);
  const isReactionPickerOpen = Boolean(reactionAnchorEl);

  useEffect(() => {
    setImageLoadError(false);
  }, [card.imageUrl]);

  const handleEdit = () => {
    if (store.canEditCard(card) && (store.phase === 'creation' || store.phase === 'discussion')) {
      setText(card.text);
      setImageUrl(card.imageUrl || '');
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (text.trim() && store.socket && (store.phase === 'creation' || store.phase === 'discussion') && store.canEditCard(card)) {
      store.socketService?.updateCard(card.id, text.trim(), imageUrl.trim() || undefined);
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    if (store.canEditCard(card) && store.socket && (store.phase === 'creation' || store.phase === 'discussion')) {
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

  const handleSelectImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.startsWith('data:image/')) {
        setImageUrl(result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
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

  const handleToggleReaction = (emoji: string) => {
    store.socketService?.toggleCardReaction(card.id, emoji);
  };

  const cardColor = theme.palette.mode === 'dark'
    ? {
        liked: '#28372d',
        disliked: '#3a2b30',
        suggestion: '#253344'
      }[card.type]
    : {
        liked: '#b2dfdb',
        disliked: '#f8bbd0',
        suggestion: '#e1bee7'
      }[card.type];

  const features = store.roomFeatures;
  const isEditingAllowed = (store.phase === 'creation' || (store.phase === 'discussion' && store.canEditCard(card)));
  const currentUserId = store.currentUser?.id || '';
  const hasLiked = card.likes?.includes(currentUserId) || false;
  const hasDisliked = card.dislikes?.includes(currentUserId) || false;
  const canEdit = store.canEditCard(card);
  const canUseSocial = store.phase !== 'rating' && (features.reactionsEnabled || features.commentsEnabled);
  const showReactions = features.reactionsEnabled;
  const showComments = features.commentsEnabled;
  const showDislikes = features.dislikesEnabled;
  const showAuthor = !features.anonymousEnabled && Boolean(card.createdBy);
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
      sx={{
        margin: 0.6,
        backgroundColor: cardColor,
        color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.92)' : 'inherit',
        position: 'relative'
      }}
    >
      <CardContent sx={{ pb: '4px !important', '&:last-child': { pb: '4px' } }}>
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
                  <input hidden type="file" accept="image/*" onChange={handleSelectImageFile} />
                </Button>
                {imageUrl.trim() && (
                  <Box
                    component="img"
                    src={imageUrl.trim()}
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
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                  {card.text}
                </Typography>
                {showAuthor && (
                  <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
                    {card.createdBy}
                  </Typography>
                )}
              </Box>
              {canEdit && isEditingAllowed && (
                <>
                  <IconButton
                    size="small"
                    onClick={handleMenuOpen}
                    aria-label="Действия с карточкой"
                    sx={{ mt: -0.5, mr: -0.5, flexShrink: 0 }}
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
                </>
              )}
            </Box>

            <Divider
              sx={{
                my: 1,
                borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'
              }}
            />

            {features.mediaEnabled && card.imageUrl && !imageLoadError && (
              <Box
                component="img"
                src={card.imageUrl}
                alt="card"
                onError={() => setImageLoadError(true)}
                sx={{
                  mt: 1,
                  width: '100%',
                  maxHeight: 260,
                  objectFit: 'contain',
                  borderRadius: 1
                }}
              />
            )}
            {features.mediaEnabled && card.imageUrl && imageLoadError && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                Не удалось загрузить изображение по этой ссылке
              </Typography>
            )}

            {showReactions && groupedReactions.length > 0 && (
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

            {canUseSocial && comments.map((comment) => (
              <Box key={comment.id} sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  {comment.text}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {formatRelativeTime(comment.createdAt)}
                </Typography>
              </Box>
            ))}

            {showComments && showCommentInput && (
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
                  <Tooltip title="Персик">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleVote('like')}
                        color={hasLiked ? 'primary' : 'default'}
                        disabled={store.phase !== 'voting'}
                      >
                        <Typography component="span" sx={{ fontSize: '1.05rem', lineHeight: 1 }}>
                          🍑
                        </Typography>
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Typography variant="body2" sx={{ ml: 0.5 }}>
                    {card.likes?.length || 0}
                  </Typography>
                </Box>
                {showDislikes && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="Тухлый помидор">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleVote('dislike')}
                        color={hasDisliked ? 'error' : 'default'}
                        disabled={store.phase !== 'voting'}
                      >
                        <Typography component="span" sx={{ fontSize: '1.05rem', lineHeight: 1 }}>
                          🍅
                        </Typography>
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
