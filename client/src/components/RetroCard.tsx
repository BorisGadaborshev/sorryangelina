import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Card as CardType } from '../types';
import { Card, CardContent, Typography, IconButton, TextField, Box, Tooltip, Alert, Button } from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { RetroStore } from '../store/RetroStore';

interface Props {
  card: CardType;
  index: number;
  store: RetroStore;
}

const RetroCard: React.FC<Props> = observer(({ card, index, store }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [imageUrl, setImageUrl] = useState(card.imageUrl || '');
  const [imageLoadError, setImageLoadError] = useState(false);
  const theme = useTheme();

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

  const isEditingAllowed = (store.phase === 'creation' || (store.phase === 'discussion' && store.canEditCard(card)));
  const currentUserId = store.currentUser?.id || '';
  const hasLiked = card.likes?.includes(currentUserId) || false;
  const hasDisliked = card.dislikes?.includes(currentUserId) || false;
  const canEdit = store.canEditCard(card);

  return (
    <Card
      sx={{ 
        margin: 0.6,
        backgroundColor: cardColor,
        color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.92)' : 'inherit',
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
            {card.imageUrl && !imageLoadError && (
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
            {card.imageUrl && imageLoadError && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                Не удалось загрузить изображение по этой ссылке
              </Typography>
            )}
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