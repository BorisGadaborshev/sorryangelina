import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, IconButton, Popover, TextField, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddReaction from '@mui/icons-material/AddReaction';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import Edit from '@mui/icons-material/Edit';
import { Card as CardType, CARD_REACTION_EMOJIS } from '../types';
import { RetroStore } from '../store/RetroStore';
import { getDislikeIconLabel, getLikeIconLabel, VoteIcon } from './VoteIcon';

interface Props {
  store: RetroStore;
  card: CardType;
  cardColor?: string;
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

const CardSocial: React.FC<Props> = observer(({ store, card, cardColor }) => {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [reactionAnchorEl, setReactionAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const features = store.roomFeatures;
  const currentUserId = store.currentUser?.id || '';
  const hasLiked = card.likes?.includes(currentUserId) || false;
  const hasDisliked = card.dislikes?.includes(currentUserId) || false;
  const canUseSocial = store.canUseCardSocial(card);
  const showReactions = features.reactionsEnabled;
  const showComments = features.commentsEnabled;
  const showDislikes = features.dislikesEnabled;
  const comments = card.comments || [];

  const groupedReactions = useMemo(() => {
    const groups = new Map<string, { emoji: string; count: number; reactedByMe: boolean }>();
    (card.reactions || []).forEach((reaction) => {
      const existing = groups.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, reactedByMe: false };
      existing.count += 1;
      if (reaction.userId === currentUserId) existing.reactedByMe = true;
      groups.set(reaction.emoji, existing);
    });
    return Array.from(groups.values());
  }, [card.reactions, currentUserId]);

  const handleSubmitComment = () => {
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    store.socketService?.addCardComment(card.id, trimmed);
    setCommentDraft('');
    setShowCommentInput(false);
  };

  const handleSaveComment = () => {
    const trimmed = editingCommentDraft.trim();
    if (!trimmed || !editingCommentId) return;
    store.socketService?.updateCardComment(card.id, editingCommentId, trimmed);
    setEditingCommentId(null);
    setEditingCommentDraft('');
  };

  const handleToggleReaction = (emoji: string) => {
    store.socketService?.toggleCardReaction(card.id, emoji);
  };

  return (
    <>
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
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
                    onClick={() => {
                      setEditingCommentId(comment.id);
                      setEditingCommentDraft(comment.text);
                    }}
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
                      setEditingCommentId(null);
                      setEditingCommentDraft('');
                    }
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSaveComment();
                    }
                  }}
                />
                <IconButton size="small" onClick={() => { setEditingCommentId(null); setEditingCommentDraft(''); }}>
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
                  onClick={() => {
                    if (store.phase === 'voting' && store.socket) {
                      store.socketService?.voteCard(card.id, 'like');
                    }
                  }}
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
                    onClick={() => {
                      if (store.phase === 'voting' && store.socket) {
                        store.socketService?.voteCard(card.id, 'dislike');
                      }
                    }}
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, pt: 0.5 }}>
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
                {comments.length}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {showReactions && canUseSocial && (
        <Popover
          open={Boolean(reactionAnchorEl)}
          anchorEl={reactionAnchorEl}
          onClose={() => setReactionAnchorEl(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, p: 1, width: 156 }}>
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
    </>
  );
});

export default CardSocial;
