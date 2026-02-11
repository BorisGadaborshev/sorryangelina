import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Card as CardType } from '../types';
import { Card, CardContent, Typography, IconButton, TextField, Box, Tooltip, Alert } from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { RetroStore } from '../store/RetroStore';

interface Props {
  card: CardType;
  index: number;
  store: RetroStore;
}

const RetroCard: React.FC<Props> = observer(({ card, index, store }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(card.text);

  const handleEdit = () => {
    if (store.canEditCard(card) && (store.phase === 'creation' || store.phase === 'discussion')) {
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (text.trim() && store.socket && (store.phase === 'creation' || store.phase === 'discussion') && store.canEditCard(card)) {
      store.socket.emit('update-card', { cardId: card.id, text: text.trim() });
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    if (store.canEditCard(card) && store.socket && (store.phase === 'creation' || store.phase === 'discussion')) {
      store.socket.emit('delete-card', { cardId: card.id });
    }
  };

  const handleVote = (voteType: 'like' | 'dislike') => {
    if (store.phase === 'voting' && store.socket) {
      store.socketService?.voteCard(card.id, voteType);
    }
  };

  const cardColor = {
    liked: '#e8f5e9',
    disliked: '#ffebee',
    suggestion: '#e3f2fd'
  }[card.type];

  const isEditingAllowed = (store.phase === 'creation' || (store.phase === 'discussion' && store.canEditCard(card)));
  const currentUserId = store.currentUser?.id || '';
  const hasLiked = card.likes?.includes(currentUserId) || false;
  const hasDisliked = card.dislikes?.includes(currentUserId) || false;
  const canEdit = store.canEditCard(card);

  return (
    <Card
      sx={{ 
        margin: 1,
        backgroundColor: cardColor,
        position: 'relative'
      }}
    >
      <CardContent>
        {isEditing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              multiline
              value={text}
              onChange={(e) => setText(e.target.value)}
              variant="outlined"
              size="small"
            />
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
            <Typography variant="body1">{card.text}</Typography>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="Персик">
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
                  </Tooltip>
                  <Typography variant="body2" sx={{ ml: 0.5 }}>
                    {card.likes?.length || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="Тухлый помидор">
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
                  </Tooltip>
                  <Typography variant="body2" sx={{ ml: 0.5 }}>
                    {card.dislikes?.length || 0}
                  </Typography>
                </Box>
              </Box>
              {canEdit && isEditingAllowed && (
                <Box>
                  <IconButton size="small" onClick={handleEdit}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" onClick={handleDelete}>
                    <Delete />
                  </IconButton>
                </Box>
              )}
            </Box>
            {store.voteError?.cardId === card.id && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {store.voteError.message}
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

export default RetroCard; 