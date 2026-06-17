import React, { useMemo, useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Paper, Typography, Box, TextField, Button, IconButton, Popover, Tooltip, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { RetroStore } from '../store/RetroStore';
import RetroCard from './RetroCard';
import { Card, DEFAULT_COLUMN_TITLES } from '../types';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ImageIcon from '@mui/icons-material/Image';
import MicIcon from '@mui/icons-material/Mic';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

const getSpeechRecognition = (): SpeechRecognitionConstructor | null =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

interface Props {
  type: 'liked' | 'disliked' | 'suggestion';
  columnIndex: number;
  store: RetroStore;
  enableDragDrop?: boolean;
  onAddCardStart?: () => void;
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

const RetroColumn: React.FC<Props> = observer(({ type, columnIndex, store, enableDragDrop = false, onAddCardStart }) => {
  const [newCardText, setNewCardText] = useState('');
  const [newCardImageUrl, setNewCardImageUrl] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [localCards, setLocalCards] = useState<Card[]>([]);
  const [addCardAnchorEl, setAddCardAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [imageAnchorEl, setImageAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [titleAtEditStart, setTitleAtEditStart] = useState('');
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const newCardTextRef = useRef(newCardText);
  const cursorPositionRef = useRef(cursorPosition);
  const isSpeechSupported = Boolean(getSpeechRecognition());

  useEffect(() => {
    newCardTextRef.current = newCardText;
  }, [newCardText]);

  useEffect(() => {
    cursorPositionRef.current = cursorPosition;
  }, [cursorPosition]);
  const isMobile = useMediaQuery('(max-width:600px)');
  const theme = useTheme();
  const displayTitle = store.getColumnTitle(columnIndex);
  const canEditTitle = store.canEditColumnTitles();

  const startEditingTitle = () => {
    if (!canEditTitle) return;
    setTitleAtEditStart(displayTitle);
    setDraftTitle(displayTitle);
    setIsEditingTitle(true);
  };

  const commitTitle = () => {
    const trimmed = draftTitle.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === displayTitle) return;
    const next = [...store.columnTitles];
    next[columnIndex] = trimmed;
    store.requestColumnTitlesUpdate(next);
  };

  const resetTitleEdit = () => {
    const originalTitle = titleAtEditStart || DEFAULT_COLUMN_TITLES[columnIndex];
    setDraftTitle(originalTitle);
    setIsEditingTitle(false);
  };

  useEffect(() => {
    const filteredCards = store.cards.filter(card => card.column === columnIndex);
    setLocalCards(filteredCards);
  }, [store.cards, columnIndex]);

  const insertDictation = (transcript: string) => {
    const cleaned = transcript.trim();
    if (!cleaned) return;

    const start = cursorPositionRef.current;
    const currentText = newCardTextRef.current;
    const before = currentText.slice(0, start);
    const after = currentText.slice(start);
    const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
    const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
    const piece = `${needsSpaceBefore ? ' ' : ''}${cleaned}${needsSpaceAfter ? ' ' : ''}`;
    const nextText = before + piece + after;
    const nextCursor = start + piece.length;

    newCardTextRef.current = nextText;
    cursorPositionRef.current = nextCursor;
    setNewCardText(nextText);
    setCursorPosition(nextCursor);
    setTimeout(() => {
      if (textFieldRef.current) {
        textFieldRef.current.focus();
        textFieldRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    }, 0);
  };

  const buildPreviewText = (base: string, cursor: number, interim: string) => {
    const before = base.slice(0, cursor);
    const after = base.slice(cursor);
    const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
    return `${before}${needsSpaceBefore ? ' ' : ''}${interim}${after}`;
  };

  const displayedCardText = useMemo(() => {
    if (!isListening || !interimTranscript) return newCardText;
    return buildPreviewText(newCardText, cursorPosition, interimTranscript);
  }, [cursorPosition, interimTranscript, isListening, newCardText]);

  const stopListening = () => {
    speechRecognitionRef.current?.stop();
    speechRecognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
  };

  const handleToggleDictation = () => {
    if (!isSpeechSupported) {
      setSpeechError('Браузер не поддерживает надиктовку');
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }

    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    setSpeechError(null);
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      let finalTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const part = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalTranscript += part;
        } else {
          interim += part;
        }
      }

      setInterimTranscript(interim);
      if (finalTranscript) {
        insertDictation(finalTranscript);
        setInterimTranscript('');
      }
    };

    recognition.onerror = () => {
      setSpeechError('Не удалось распознать речь');
      stopListening();
    };

    recognition.onend = () => {
      speechRecognitionRef.current = null;
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    textFieldRef.current?.focus();
  };

  useEffect(() => {
    if (!addCardAnchorEl) {
      stopListening();
      setSpeechError(null);
      setInterimTranscript('');
    }
  }, [addCardAnchorEl]);

  useEffect(() => () => {
    speechRecognitionRef.current?.abort();
  }, []);

  const handleAddCard = () => {
    if (newCardText.trim() && store.socket && store.phase === 'creation') {
      const text = selectedEmoji ? `${selectedEmoji} ${newCardText.trim()}` : newCardText.trim();
      store.socketService?.addCard(text, type, columnIndex, newCardImageUrl.trim() || undefined);
      setNewCardText('');
      setNewCardImageUrl('');
      setSelectedEmoji('');
      setAnchorEl(null);
      setImageAnchorEl(null);
      setAddCardAnchorEl(null);
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
    cursorPositionRef.current = position;
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

  const columnColor = theme.palette.mode === 'dark'
    ? {
        liked: '#1f2a23',
        disliked: '#2a1f23',
        suggestion: '#1d2530'
      }[type]
    : {
        liked: '#e0f2ef',
        disliked: '#fce4ec',
        suggestion: '#f3e5f5'
      }[type];

  const columnAccent = theme.palette.mode === 'dark'
    ? {
        liked: '#26a69a',
        disliked: '#ec407a',
        suggestion: '#ab47bc'
      }[type]
    : {
        liked: '#009688',
        disliked: '#e91e63',
        suggestion: '#9c27b0'
      }[type];

  return (
    <Paper 
      elevation={2}
      sx={{
        width: '100%',
        minWidth: isMobile ? '100%' : '300px',
        minHeight: isMobile ? 'auto' : '70vh',
        p: 1.25,
        backgroundColor: columnColor,
        color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.92)' : 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75
      }}
    >
      <Box
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        onDoubleClick={startEditingTitle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          mb: 0.5,
          minHeight: 40,
          px: 0.5
        }}
      >
        {isEditingTitle ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flex: 1, maxWidth: 360 }}>
            <TextField
              size="small"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitTitle();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  resetTitleEdit();
                }
              }}
              autoFocus
              fullWidth
              inputProps={{ maxLength: 80 }}
            />
            <Tooltip title="Сохранить">
              <IconButton
                size="small"
                color="primary"
                onMouseDown={(event) => event.preventDefault()}
                onClick={commitTitle}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Вернуть исходное название">
              <IconButton
                size="small"
                onMouseDown={(event) => event.preventDefault()}
                onClick={resetTitleEdit}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <>
            <Typography variant="h6" align="center" sx={{ flex: 1 }}>
              {displayTitle}
            </Typography>
            {canEditTitle && isHeaderHovered && (
              <Tooltip title="Изменить название">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    startEditingTitle();
                  }}
                  sx={{ opacity: 0.85 }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </Box>
      <Box sx={{ height: 4, borderRadius: 999, backgroundColor: columnAccent, mb: 0.5 }} />

      {store.phase === 'creation' && (
        <Box sx={{ mb: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
            <Tooltip title="Добавить карточку">
              <IconButton
                color="primary"
                onClick={(event) => {
                  onAddCardStart?.();
                  setAddCardAnchorEl(event.currentTarget);
                }}
                sx={{ position: 'relative', zIndex: 4, border: '1px solid', borderColor: 'divider' }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Popover
            open={Boolean(addCardAnchorEl)}
            anchorEl={addCardAnchorEl}
            onClose={() => setAddCardAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Box sx={{ p: 1.5, width: 360, maxWidth: '92vw' }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={isMobile ? 2 : 3}
                  variant="outlined"
                  placeholder="Добавить новую карточку..."
                  value={displayedCardText}
                  onChange={(e) => {
                    if (isListening) {
                      setInterimTranscript('');
                    }
                    const value = e.target.value;
                    newCardTextRef.current = value;
                    setNewCardText(value);
                  }}
                  inputRef={textFieldRef}
                  size="small"
                  sx={isListening ? {
                    '& .MuiOutlinedInput-root': {
                      animation: 'dictationPulse 1.4s ease-in-out infinite',
                      '@keyframes dictationPulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.35)' },
                        '70%': { boxShadow: '0 0 0 8px rgba(211, 47, 47, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' }
                      },
                      '& fieldset': {
                        borderColor: 'error.main',
                        borderWidth: 2
                      }
                    }
                  } : undefined}
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
                          disabled={!store.roomFeatures.mediaEnabled}
                        >
                          <ImageIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title={isListening ? 'Остановить надиктовку' : 'Надиктовать текст'}>
                          <span>
                            <IconButton
                              onClick={handleToggleDictation}
                              disabled={!isSpeechSupported}
                              color={isListening ? 'error' : 'default'}
                              sx={{
                                p: 0.5,
                                opacity: isListening ? 1 : 0.7,
                                animation: isListening ? 'micPulse 1s ease-in-out infinite' : 'none',
                                '@keyframes micPulse': {
                                  '0%, 100%': { transform: 'scale(1)' },
                                  '50%': { transform: 'scale(1.15)' }
                                },
                                '&:hover': { backgroundColor: 'transparent', opacity: 1 }
                              }}
                            >
                              <MicIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    )
                  }}
                />
              </Box>
              {speechError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                  {speechError}
                </Typography>
              )}
              {isListening && (
                <Box
                  sx={{
                    mb: 1,
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor: 'error.main',
                    color: 'error.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'error.contrastText',
                      animation: 'recordDot 1s ease-in-out infinite',
                      '@keyframes recordDot': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.25 }
                      }
                    }}
                  />
                  <Typography variant="caption" sx={{ flex: 1 }}>
                    {interimTranscript
                      ? `Слушаю: «${interimTranscript.trim()}»`
                      : 'Говорите... текст появится в поле выше'}
                  </Typography>
                </Box>
              )}
              <Button
                fullWidth
                variant="contained"
                onClick={handleAddCard}
                disabled={!newCardText.trim()}
              >
                Добавить
              </Button>
            </Box>
          </Popover>
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