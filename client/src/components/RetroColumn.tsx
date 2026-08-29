import React, { useMemo, useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Paper, Typography, Box, TextField, Button, IconButton, Popover, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { RetroStore } from '../store/RetroStore';
import RetroCard from './RetroCard';
import { Card, COLUMN_COLOR_IDS, COLUMN_COLOR_PRESETS, DEFAULT_COLUMN_TITLES, LETS_DO_COLUMN_INDEX, buildColumnMarkdown, getColumnColorStyles } from '../types';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ImageIcon from '@mui/icons-material/Image';
import MicIcon from '@mui/icons-material/Mic';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

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
  const [headerMenuAnchorEl, setHeaderMenuAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [colorMenuAnchorEl, setColorMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
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
  const columnColorId = store.getColumnColor(columnIndex);
  const columnThemeColors = getColumnColorStyles(columnColorId, theme.palette.mode);
  const showHeaderActions = canEditTitle;
  const canAddCards = store.canAddCards(columnIndex);
  const canCopyMarkdown = columnIndex === LETS_DO_COLUMN_INDEX;

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

  const applyColumnColor = (colorId: typeof COLUMN_COLOR_IDS[number]) => {
    setColorMenuAnchorEl(null);
    setHeaderMenuAnchorEl(null);
    if (colorId === columnColorId) return;
    const next = [...store.columnColors];
    next[columnIndex] = colorId;
    store.requestColumnColorsUpdate(next);
  };

  const closeHeaderMenus = () => {
    setHeaderMenuAnchorEl(null);
    setColorMenuAnchorEl(null);
  };

  const handleCopyColumnMarkdown = async () => {
    const markdown = buildColumnMarkdown(localCards);
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setCopySuccess(false);
    }
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

  useEffect(() => {
    if (!canAddCards) {
      setAddCardAnchorEl(null);
    }
  }, [canAddCards]);

  useEffect(() => () => {
    speechRecognitionRef.current?.abort();
  }, []);

  const handleAddCard = () => {
    if (newCardText.trim() && store.socket && store.phase === 'creation' && canAddCards) {
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

  return (
    <Paper 
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: '100%',
        flex: isMobile ? '0 0 auto' : '1 1 0',
        minWidth: isMobile ? '100%' : 0,
        minHeight: isMobile ? 'auto' : 0,
        height: isMobile ? 'auto' : '100%',
        maxHeight: isMobile ? 'none' : '100%',
        p: 1.25,
        bgcolor: 'transparent',
        backgroundImage: 'none',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75
      }}
    >
      <Box
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
            {canCopyMarkdown && (
              <Tooltip title={copySuccess ? 'Скопировано' : 'Копировать в Markdown'}>
                <span>
                  <IconButton
                    size="small"
                    aria-label="Копировать колонку в Markdown"
                    disabled={localCards.length === 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCopyColumnMarkdown();
                    }}
                    onDoubleClick={(event) => event.stopPropagation()}
                    sx={{ opacity: 0.85 }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {showHeaderActions && (
              <>
                <IconButton
                  size="small"
                  aria-label="Действия с колонкой"
                  onClick={(event) => {
                    event.stopPropagation();
                    setHeaderMenuAnchorEl(event.currentTarget);
                  }}
                  onDoubleClick={(event) => event.stopPropagation()}
                  sx={{ opacity: 0.85 }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu
                  anchorEl={headerMenuAnchorEl}
                  open={Boolean(headerMenuAnchorEl)}
                  onClose={() => setHeaderMenuAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  {canCopyMarkdown && (
                    <MenuItem
                      disabled={localCards.length === 0}
                      onClick={() => {
                        closeHeaderMenus();
                        handleCopyColumnMarkdown();
                      }}
                    >
                      <ListItemIcon>
                        <ContentCopyIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>{copySuccess ? 'Скопировано' : 'Копировать в Markdown'}</ListItemText>
                    </MenuItem>
                  )}
                  <MenuItem
                    onClick={() => {
                      closeHeaderMenus();
                      startEditingTitle();
                    }}
                  >
                    <ListItemIcon>
                      <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Изменить название</ListItemText>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setColorMenuAnchorEl(headerMenuAnchorEl);
                      setHeaderMenuAnchorEl(null);
                    }}
                  >
                    <ListItemIcon>
                      <FormatColorFillIcon fontSize="small" sx={{ color: columnThemeColors.accent }} />
                    </ListItemIcon>
                    <ListItemText>Цвет колонки</ListItemText>
                  </MenuItem>
                </Menu>
                <Menu
                  anchorEl={colorMenuAnchorEl}
                  open={Boolean(colorMenuAnchorEl)}
                  onClose={() => setColorMenuAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  {COLUMN_COLOR_IDS.map((colorId) => {
                    const preset = COLUMN_COLOR_PRESETS[colorId];
                    const isSelected = colorId === columnColorId;
                    return (
                      <MenuItem
                        key={colorId}
                        selected={isSelected}
                        onClick={() => applyColumnColor(colorId)}
                        sx={{ gap: 1.25, minWidth: 196 }}
                      >
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            flexShrink: 0
                          }}
                        >
                          <Box sx={{ flex: 1, display: 'flex' }}>
                            <Box sx={{ flex: 1, bgcolor: colorId === 'none' ? 'background.paper' : preset.light.bg }} />
                            <Box sx={{ flex: 1, bgcolor: colorId === 'none' ? '#1e1e1e' : preset.dark.bg }} />
                          </Box>
                          <Box sx={{ height: 4, display: 'flex' }}>
                            <Box sx={{ flex: 1, bgcolor: preset.light.accent }} />
                            <Box sx={{ flex: 1, bgcolor: preset.dark.accent }} />
                          </Box>
                        </Box>
                        {preset.label}
                      </MenuItem>
                    );
                  })}
                </Menu>
              </>
            )}
          </>
        )}
      </Box>
      <Box sx={{ height: 4, borderRadius: 999, backgroundColor: columnThemeColors.accent, mb: 0.5 }} />

      {store.phase === 'creation' && (
        <Box sx={{ mb: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
            <Tooltip
              title={
                canAddCards
                  ? 'Добавить карточку'
                  : 'Только администратор может добавлять карточки в эту колонку'
              }
            >
              <span>
                <IconButton
                  color="primary"
                  disabled={!canAddCards}
                  onClick={(event) => {
                    if (!canAddCards) return;
                    onAddCardStart?.();
                    setAddCardAnchorEl(event.currentTarget);
                  }}
                  sx={{
                    position: 'relative',
                    zIndex: 4,
                    border: '1px solid',
                    borderColor: canAddCards ? 'divider' : 'action.disabled',
                    '&.Mui-disabled': {
                      color: 'action.disabled'
                    }
                  }}
                >
                  <AddIcon />
                </IconButton>
              </span>
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
        <Droppable droppableId={`column-${columnIndex}`} isCombineEnabled={store.canMergeCards}>
          {(provided, snapshot) => (
            <Box
              ref={provided.innerRef}
              {...provided.droppableProps}
              sx={{
                flexGrow: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1,
                backgroundColor: snapshot.isDraggingOver ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                transition: 'background-color 0.2s ease'
              }}
            >
              {localCards.map((card, index) => (
                <Draggable key={card.id} draggableId={card.id} index={index} isDragDisabled={!store.canMoveCard(card)}>
                  {(dragProvided, dragSnapshot) => (
                    <Box
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      sx={{
                        opacity: dragSnapshot.isDragging ? 0.85 : 1
                      }}
                    >
                      <RetroCard
                        card={card}
                        index={index}
                        store={store}
                        isMergeDropTarget={Boolean(dragSnapshot.combineTargetFor)}
                      />
                    </Box>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      ) : (
        <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {localCards.map((card, index) => (
            <RetroCard key={card.id} card={card} index={index} store={store} />
          ))}
        </Box>
      )}
    </Paper>
  );
});

export default RetroColumn; 