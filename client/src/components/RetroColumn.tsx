import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Paper, Typography, Box, TextField, Button, IconButton, Popover, useMediaQuery } from '@mui/material';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { RetroStore } from '../store/RetroStore';
import RetroCard from './RetroCard';
import { Card } from '../types';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ImageIcon from '@mui/icons-material/Image';

interface Props {
  title: string;
  type: 'liked' | 'disliked' | 'suggestion';
  columnIndex: number;
  store: RetroStore;
  enableDragDrop?: boolean;
}

const EMOJI_GROUPS = {
  'liked': [
    '😊', '🎉', '👍', '⭐', '🌟', '💪', '🙌', '👏', '✨', '🎯',
    '❤️', '🥰', '😍', '🤩', '😇', '🥳', '🔥', '💯', '👌', '💖',
    '💝', '💫', '🌈', '🎨', '🎭', '🎪', '🎡', '🎢', '🎠', '🎬'
  ],
  'disliked': [
    '😕', '😢', '😩', '😫', '😤', '😠', '😡', '💔', '⚠️', '❌',
    '😞', '😔', '😣', '😖', '😨', '😰', '😥', '😪', '😓', '😭',
    '🤔', '🤨', '😒', '🙄', '😑', '😐', '😶', '🤦', '🤷', '💩'
  ],
  'suggestion': [
    '💡', '🎨', '🔧', '🛠️', '📝', '✏️', '🎯', '🎪', '🎭', '🎬',
    '📌', '📍', '💭', '🗯️', '💬', '📢', '🔍', '⚡', '💫', '🌟',
    '🎵', '🎶', '📱', '💻', '⌨️', '🖥️', '🎮', '🎲', '🔮', '✨'
  ]
};

const RetroColumn: React.FC<Props> = observer(({ title, type, columnIndex, store, enableDragDrop = false }) => {
  const [newCardText, setNewCardText] = useState('');
  const [newCardImageUrl, setNewCardImageUrl] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [localCards, setLocalCards] = useState<Card[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [imageAnchorEl, setImageAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery('(max-width:600px)');

  useEffect(() => {
    const filteredCards = store.cards.filter(card => card.column === columnIndex);
    setLocalCards(filteredCards);
  }, [store.cards, columnIndex]);

  const handleAddCard = () => {
    if (newCardText.trim() && store.socket && store.phase === 'creation') {
      const text = selectedEmoji ? `${selectedEmoji} ${newCardText.trim()}` : newCardText.trim();
      store.socketService?.addCard(text, type, columnIndex, newCardImageUrl.trim() || undefined);
      setNewCardText('');
      setNewCardImageUrl('');
      setSelectedEmoji('');
    }
  };

  const handleEmojiClick = (emoji: string) => {
    const start = cursorPosition;
    const newText = newCardText.slice(0, start) + emoji + ' ' + newCardText.slice(start);
    setNewCardText(newText);
    setAnchorEl(null);
    setTimeout(() => {
      if (textFieldRef.current) {
        textFieldRef.current.focus();
        const newCursorPos = start + emoji.length + 1;
        textFieldRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleCursorTracking = (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const position = event.currentTarget.selectionStart ?? 0;
    setCursorPosition(position);
  };

  const handleSelectImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.startsWith('data:image/')) {
        setNewCardImageUrl(result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const columnColor = {
    liked: '#e8f5e9',
    disliked: '#ffebee',
    suggestion: '#e3f2fd'
  }[type];

  return (
    <Paper 
      elevation={2}
      sx={{
        width: '100%',
        minWidth: isMobile ? '100%' : '300px',
        minHeight: isMobile ? 'auto' : '70vh',
        p: 2,
        backgroundColor: columnColor,
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      <Typography variant="h6" gutterBottom align="center">
        {title}
      </Typography>

      {store.phase === 'creation' && (
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={isMobile ? 1 : 2}
              variant="outlined"
              placeholder="Добавить новую карточку..."
              value={newCardText}
              onChange={(e) => setNewCardText(e.target.value)}
              inputRef={textFieldRef}
              size="small"
              inputProps={{
                onClick: handleCursorTracking,
                onKeyUp: handleCursorTracking,
                onSelect: handleCursorTracking
              }}
              InputProps={{
                endAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton 
                      onClick={(e) => setAnchorEl(e.currentTarget)}
                      sx={{ p: 0.5, opacity: 0.6, '&:hover': { backgroundColor: 'transparent', opacity: 1 } }}
                    >
                      <EmojiEmotionsIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      onClick={(e) => setImageAnchorEl(e.currentTarget)}
                      color={newCardImageUrl.trim() ? 'primary' : 'default'}
                      sx={{ p: 0.5, opacity: 0.7, '&:hover': { backgroundColor: 'transparent', opacity: 1 } }}
                    >
                      <ImageIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )
              }}
            />
          </Box>
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5, maxWidth: '400px' }}>
              {EMOJI_GROUPS[type].map((emoji) => (
                <IconButton
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  sx={{ fontSize: '1.2rem', width: 32, height: 32, '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                >
                  {emoji}
                </IconButton>
              ))}
            </Box>
          </Popover>
          <Popover
            open={Boolean(imageAnchorEl)}
            anchorEl={imageAnchorEl}
            onClose={() => setImageAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ p: 1.5, width: 320 }}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                label="Ссылка на изображение"
                placeholder="https://..."
                value={newCardImageUrl}
                onChange={(event) => setNewCardImageUrl(event.target.value)}
                helperText="Можно вставить ссылку или выбрать файл"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleSelectImageFile}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => imageInputRef.current?.click()}
                >
                  Выбрать файл
                </Button>
                {newCardImageUrl.trim() && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setNewCardImageUrl('')}
                  >
                    Убрать
                  </Button>
                )}
              </Box>
              {newCardImageUrl.trim() && (
                <Box
                  component="img"
                  src={newCardImageUrl.trim()}
                  alt="preview"
                  sx={{
                    mt: 1,
                    width: '100%',
                    maxHeight: 140,
                    objectFit: 'contain',
                    borderRadius: 1,
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}
                />
              )}
            </Box>
          </Popover>
          <Button
            fullWidth
            variant="contained"
            onClick={handleAddCard}
            disabled={!newCardText.trim()}
          >
            Добавить
          </Button>
        </Box>
      )}

      {enableDragDrop ? (
        <Droppable droppableId={`column-${columnIndex}`}>
          {(provided, snapshot) => (
            <Box
              ref={provided.innerRef}
              {...provided.droppableProps}
              sx={{
                flexGrow: 1,
                minHeight: '100px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1,
                backgroundColor: snapshot.isDraggingOver ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              {localCards.map((card, index) => (
                <Draggable key={card.id} draggableId={card.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <Box
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      sx={{
                        opacity: dragSnapshot.isDragging ? 0.85 : 1
                      }}
                    >
                      <RetroCard card={card} index={index} store={store} />
                    </Box>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      ) : (
        <Box sx={{ flexGrow: 1, minHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {localCards.map((card, index) => (
            <RetroCard key={card.id} card={card} index={index} store={store} />
          ))}
        </Box>
      )}
    </Paper>
  );
});

export default RetroColumn; 