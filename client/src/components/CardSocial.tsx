import React, { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Box, IconButton, Popover, TextField, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import Edit from '@mui/icons-material/Edit';
import { Card as CardType, CARD_REACTION_EMOJIS } from '../types';
import { RetroStore } from '../store/RetroStore';
import { getDislikeIconLabel, getLikeIconLabel, VoteIcon } from './VoteIcon';

interface Props {
  store: RetroStore;
  card: CardType;
}

const socialGlyphSx = { width: 16, height: 16, display: 'block', flexShrink: 0 };

const ReactionIcon: React.FC = () => (
  <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={socialGlyphSx}>
    <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="9.1" cy="10.45" r="0.95" fill="currentColor" />
    <circle cx="14.9" cy="10.45" r="0.95" fill="currentColor" />
    <path
      d="M8.45 13.7c.95 1.5 2.1 2.15 3.55 2.15s2.6-.65 3.55-2.15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
  </Box>
);

const CommentIcon: React.FC = () => (
  <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={socialGlyphSx}>
    <path
      d="M6.5 5.15h11a2.35 2.35 0 0 1 2.35 2.35v5.7a2.35 2.35 0 0 1-2.35 2.35H11.3l-3.15 2.75V15.55H6.5a2.35 2.35 0 0 1-2.35-2.35V7.5A2.35 2.35 0 0 1 6.5 5.15Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinejoin="round"
    />
  </Box>
);

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

const commentActionButtonSx = {
  width: 26,
  height: 26,
  borderRadius: '6px'
};

const getCommentFieldSx = (isDark: boolean) => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    fontSize: '0.8rem',
    lineHeight: 1.35,
    borderRadius: '8px',
    alignItems: 'flex-end',
    pr: 0.25,
    bgcolor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.88)'
  },
  '& .MuiOutlinedInput-input': {
    py: 0.75,
    px: 1
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(20,24,40,0.22)'
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: isDark ? 'rgba(255,255,255,0.46)' : 'rgba(20,24,40,0.4)'
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderWidth: '1px'
  }
});

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

const CardSocial: React.FC<Props> = observer(({ store, card }) => {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [reactionAnchorEl, setReactionAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const ink = isDark ? 'rgba(255,255,255,0.82)' : 'rgba(20,24,40,0.78)';
  const inkMuted = isDark ? 'rgba(255,255,255,0.48)' : 'rgba(20,24,40,0.48)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,24,40,0.06)';
  const activeBg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,24,40,0.08)';
  const hairline = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,24,40,0.08)';
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

  const commentFieldSx = getCommentFieldSx(isDark);

  const handleSubmitComment = () => {
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    store.socketService?.addCardComment(card.id, trimmed);
    setCommentDraft('');
    setShowCommentInput(false);
  };

  const handleDismissComment = () => {
    if (commentDraft) {
      setCommentDraft('');
      return;
    }
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
      {canUseSocial && comments.map((comment) => {
        const authorShortName = formatCommentAuthorName(comment.userName || '');
        const canEditComment = showComments && comment.userId === currentUserId;
        const isEditingComment = editingCommentId === comment.id;
        return (
          <Box
            key={comment.id}
            sx={{
              mt: 0.75,
              px: 0.15,
              py: 0.35
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              {authorShortName && (
                <Tooltip title={comment.userName} placement="top">
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      lineHeight: 1.3,
                      minWidth: 0,
                      maxWidth: '58%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: ink
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
                  color: inkMuted
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
              <TextField
                size="small"
                value={editingCommentDraft}
                onChange={(event) => setEditingCommentDraft(event.target.value)}
                fullWidth
                multiline
                maxRows={3}
                autoFocus
                sx={{ ...commentFieldSx, mt: 0.5 }}
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
                InputProps={{
                  endAdornment: (
                    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, mb: 0.15 }}>
                      <IconButton size="small" aria-label="Отменить редактирование" onClick={() => { setEditingCommentId(null); setEditingCommentDraft(''); }} sx={commentActionButtonSx}>
                        <Close sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton size="small" color="primary" aria-label="Сохранить комментарий" onClick={handleSaveComment} disabled={!editingCommentDraft.trim()} sx={commentActionButtonSx}>
                        <Check sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  )
                }}
              />
            ) : (
              <Typography
                variant="body2"
                sx={{
                  mt: 0.25,
                  wordBreak: 'break-word',
                  fontSize: '0.8rem',
                  lineHeight: 1.35,
                  color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(20,24,40,0.88)'
                }}
              >
                {comment.text}
              </Typography>
            )}
          </Box>
        );
      })}

      {showComments && canUseSocial && showCommentInput && (
        <TextField
          size="small"
          value={commentDraft}
          onChange={(event) => setCommentDraft(event.target.value)}
          placeholder="Комментарий"
          fullWidth
          multiline
          maxRows={3}
          sx={{ ...commentFieldSx, mt: 0.75 }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              handleDismissComment();
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmitComment();
            }
          }}
          InputProps={{
            endAdornment: (
              <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, mb: 0.15 }}>
                <Tooltip title={commentDraft ? 'Очистить' : 'Закрыть'}>
                  <IconButton
                    size="small"
                    aria-label={commentDraft ? 'Очистить комментарий' : 'Закрыть комментарий'}
                    onClick={handleDismissComment}
                    sx={commentActionButtonSx}
                  >
                    <Close sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <IconButton
                  size="small"
                  color="primary"
                  aria-label="Отправить комментарий"
                  onClick={handleSubmitComment}
                  disabled={!commentDraft.trim()}
                  sx={commentActionButtonSx}
                >
                  <Check sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            )
          }}
        />
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

      {canUseSocial && (showReactions || showComments) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 0.5, rowGap: 0.5, mt: 0.75, minWidth: 0 }}>
          {showReactions && groupedReactions.map((group) => (
            <Box
              key={group.emoji}
              component="button"
              type="button"
              onClick={() => handleToggleReaction(group.emoji)}
              aria-label={`${group.emoji} ${group.count}`}
              aria-pressed={group.reactedByMe}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: 24,
                m: 0,
                px: 0.7,
                borderRadius: 999,
                border: '1px solid',
                borderColor: group.reactedByMe ? (isDark ? 'rgba(255,255,255,0.28)' : 'rgba(20,24,40,0.16)') : 'transparent',
                cursor: 'pointer',
                font: 'inherit',
                color: ink,
                bgcolor: group.reactedByMe
                  ? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.92)')
                  : (isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.62)'),
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.9)'
                }
              }}
            >
              <Box component="span" sx={{ fontSize: 14, lineHeight: 1, width: 18, textAlign: 'center' }}>
                {group.emoji}
              </Box>
              <Box component="span" sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {group.count}
              </Box>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto', flexShrink: 0 }}>
            {showReactions && (
              <Tooltip title="Реакция">
                <Box
                  component="button"
                  type="button"
                  aria-label="Добавить реакцию"
                  aria-pressed={Boolean(reactionAnchorEl)}
                  onClick={(event) => setReactionAnchorEl(event.currentTarget)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    m: 0,
                    p: 0,
                    border: 0,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: ink,
                    bgcolor: reactionAnchorEl ? activeBg : 'transparent',
                    transition: 'background-color 0.15s ease',
                    '&:hover': { bgcolor: reactionAnchorEl ? activeBg : hoverBg }
                  }}
                >
                  <ReactionIcon />
                </Box>
              </Tooltip>
            )}
            {showComments && (
              <Tooltip title="Комментарий">
                <Box
                  component="button"
                  type="button"
                  aria-label="Комментарий"
                  aria-pressed={showCommentInput}
                  onClick={() => setShowCommentInput((value) => !value)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.4,
                    height: 28,
                    m: 0,
                    px: 0.4,
                    border: 0,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: ink,
                    bgcolor: showCommentInput ? activeBg : 'transparent',
                    transition: 'background-color 0.15s ease',
                    '&:hover': { bgcolor: showCommentInput ? activeBg : hoverBg }
                  }}
                >
                  <CommentIcon />
                  <Box
                    component="span"
                    sx={{
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      opacity: comments.length > 0 ? 1 : 0.55
                    }}
                  >
                    {comments.length}
                  </Box>
                </Box>
              </Tooltip>
            )}
          </Box>
        </Box>
      )}

      {showReactions && canUseSocial && (
        <Popover
          open={Boolean(reactionAnchorEl)}
          anchorEl={reactionAnchorEl}
          onClose={() => setReactionAnchorEl(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          PaperProps={{
            sx: {
              mt: -0.5,
              borderRadius: '14px',
              bgcolor: isDark ? '#2a2d33' : '#fff',
              boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 28px rgba(20,24,40,0.16)'
            }
          }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 36px)', gap: 0.25, p: 0.75 }}>
            {CARD_REACTION_EMOJIS.map((emoji) => {
              const reactedByMe = (card.reactions || []).some(
                (reaction) => reaction.emoji === emoji && reaction.userId === currentUserId
              );
              return (
                <IconButton
                  key={emoji}
                  size="small"
                  aria-label={emoji}
                  aria-pressed={reactedByMe}
                  onClick={() => {
                    handleToggleReaction(emoji);
                    setReactionAnchorEl(null);
                  }}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    fontSize: '1.15rem',
                    bgcolor: reactedByMe ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,24,40,0.08)') : 'transparent',
                    boxShadow: reactedByMe ? `inset 0 0 0 1px ${hairline}` : 'none',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,24,40,0.06)'
                    }
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
