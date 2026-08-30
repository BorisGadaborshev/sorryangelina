import React, { useMemo, useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Paper, Typography, Box, TextField, IconButton, Popover, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, useMediaQuery } from '@mui/material';
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
import { fileToImageDataUrl, IMAGE_FILE_ACCEPT, resolveMediaUrl } from '../utils/media';

const getSpeechRecognition = (): SpeechRecognitionConstructor | null =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const extractPastedImageUrl = (pasted: string): { url: string; leftover: string } | null => {
  const match = pasted.match(/https?:\/\/[^\s<>"']+/i);
  if (!match || match.index === undefined) return null;
  const url = match[0].replace(/[)\].,;!?]+$/g, '');
  if (!/^https?:\/\//i.test(url)) return null;
  const leftover = `${pasted.slice(0, match.index)}${pasted.slice(match.index + match[0].length)}`.trim();
  return { url, leftover };
};

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
  const [imagePickError, setImagePickError] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [localCards, setLocalCards] = useState<Card[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
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
    if (!isComposerOpen) {
      stopListening();
      setSpeechError(null);
      setInterimTranscript('');
      setAnchorEl(null);
      return;
    }
    const focusTimer = window.setTimeout(() => {
      textFieldRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [isComposerOpen]);

  useEffect(() => {
    if (!canAddCards) {
      setIsComposerOpen(false);
    }
  }, [canAddCards]);

  useEffect(() => () => {
    speechRecognitionRef.current?.abort();
  }, []);

  const resetComposerInput = () => {
    stopListening();
    setNewCardText('');
    setNewCardImageUrl('');
    setImagePickError('');
    setSelectedEmoji('');
    setSpeechError(null);
    setInterimTranscript('');
    newCardTextRef.current = '';
    cursorPositionRef.current = 0;
    setTimeout(() => {
      textFieldRef.current?.focus();
    }, 0);
  };

  const handleComposerResetOrClose = () => {
    if (!newCardText.trim() && !newCardImageUrl.trim()) {
      resetComposerInput();
      setIsComposerOpen(false);
      return;
    }
    resetComposerInput();
  };

  const handleAddCard = () => {
    const trimmed = newCardText.trim();
    const imageUrl = newCardImageUrl.trim();
    if ((!trimmed && !imageUrl) || !store.socket || store.phase !== 'creation' || !canAddCards) return;
    const text = selectedEmoji && trimmed ? `${selectedEmoji} ${trimmed}` : trimmed;
    store.socketService?.addCard(text, type, columnIndex, imageUrl || undefined);
    resetComposerInput();
    setIsComposerOpen(false);
  };

  const applyPastedImageUrl = (url: string, leftover: string) => {
    setNewCardImageUrl(url);
    const start = textFieldRef.current?.selectionStart ?? cursorPositionRef.current;
    const end = textFieldRef.current?.selectionEnd ?? start;
    const current = newCardTextRef.current;
    const nextText = current.slice(0, start) + leftover + current.slice(end);
    const nextCursor = start + leftover.length;
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

  const handleSelectImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await fileToImageDataUrl(file);
      setNewCardImageUrl(dataUrl);
      setImagePickError('');
    } catch (error) {
      setImagePickError(error instanceof Error ? error.message : 'Не удалось загрузить изображение');
    }
  };

  return (
    <Paper 
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: '100%',
        flex: isMobile ? '0 0 auto' : '1 1 0',
        minWidth: isMobile ? '100%' : 0,
        minHeight: isMobile ? 'auto' : '100%',
        height: 'auto',
        maxHeight: 'none',
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
                  aria-label="Добавить карточку"
                  disabled={!canAddCards}
                  onClick={() => {
                    if (!canAddCards) return;
                    onAddCardStart?.();
                    setIsComposerOpen((open) => !open);
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
          {isComposerOpen && (
            <Box
              sx={{
                mt: 0.75,
                px: 1.25,
                pt: 0.75,
                pb: 0.5,
                borderRadius: 1.5,
                border: '2px solid',
                borderColor: isListening ? 'error.main' : 'primary.main',
                bgcolor: 'background.paper',
                animation: isListening ? 'dictationPulse 1.4s ease-in-out infinite' : 'none',
                '@keyframes dictationPulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.35)' },
                  '70%': { boxShadow: '0 0 0 8px rgba(211, 47, 47, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' }
                }
              }}
            >
              <TextField
                fullWidth
                multiline
                minRows={2}
                variant="standard"
                placeholder="Напишите что-нибудь..."
                value={displayedCardText}
                onChange={(e) => {
                  if (isListening) {
                    setInterimTranscript('');
                  }
                  const value = e.target.value;
                  newCardTextRef.current = value;
                  setNewCardText(value);
                }}
                onPaste={(event) => {
                  if (!store.roomFeatures.mediaEnabled) return;
                  const pasted = event.clipboardData.getData('text');
                  const extracted = extractPastedImageUrl(pasted);
                  if (!extracted) return;
                  event.preventDefault();
                  applyPastedImageUrl(extracted.url, extracted.leftover);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    handleComposerResetOrClose();
                    return;
                  }
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    handleAddCard();
                  }
                }}
                inputRef={textFieldRef}
                InputProps={{ disableUnderline: true }}
                inputProps={{
                  onClick: handleCursorTracking,
                  onKeyUp: handleCursorTracking,
                  onSelect: handleCursorTracking
                }}
              />
              {newCardImageUrl.trim() && (
                <Box sx={{ position: 'relative', mt: 0.5 }}>
                  <Box
                    component="img"
                    src={resolveMediaUrl(newCardImageUrl.trim())}
                    alt="preview"
                    sx={{
                      width: '100%',
                      maxHeight: 120,
                      objectFit: 'contain',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  />
                  <Tooltip title="Убрать изображение">
                    <IconButton
                      size="small"
                      aria-label="Убрать изображение"
                      onClick={() => setNewCardImageUrl('')}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'background.paper',
                        opacity: 0.9,
                        '&:hover': { bgcolor: 'background.paper' }
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
              {imagePickError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5 }}>
                  {imagePickError}
                </Typography>
              )}
              {speechError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5 }}>
                  {speechError}
                </Typography>
              )}
              {isListening && (
                <Box
                  sx={{
                    mb: 0.75,
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
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="Эмодзи">
                    <IconButton
                      size="small"
                      aria-label="Эмодзи"
                      onClick={(e) => setAnchorEl(e.currentTarget)}
                      sx={{ p: 0.5, opacity: 0.7, '&:hover': { backgroundColor: 'transparent', opacity: 1 } }}
                    >
                      <EmojiEmotionsIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Выбрать изображение с диска">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Выбрать изображение с диска"
                        onClick={() => imageInputRef.current?.click()}
                        color={newCardImageUrl.trim() ? 'primary' : 'default'}
                        sx={{ p: 0.5, opacity: 0.7, '&:hover': { backgroundColor: 'transparent', opacity: 1 } }}
                        disabled={!store.roomFeatures.mediaEnabled}
                      >
                        <ImageIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={isListening ? 'Остановить надиктовку' : 'Надиктовать текст'}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={isListening ? 'Остановить надиктовку' : 'Надиктовать текст'}
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
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title={newCardText.trim() || newCardImageUrl.trim() ? 'Сбросить' : 'Закрыть'}>
                    <IconButton
                      size="small"
                      aria-label={newCardText.trim() || newCardImageUrl.trim() ? 'Сбросить' : 'Закрыть'}
                      onClick={handleComposerResetOrClose}
                      sx={{ opacity: 0.7 }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Сохранить">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Сохранить"
                        color="primary"
                        onClick={handleAddCard}
                        disabled={!newCardText.trim() && !newCardImageUrl.trim()}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          )}
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
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
          <input
            ref={imageInputRef}
            type="file"
            accept={IMAGE_FILE_ACCEPT}
            style={{ display: 'none' }}
            onChange={handleSelectImageFile}
          />
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
                overflow: 'visible',
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
        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
          {localCards.map((card, index) => (
            <RetroCard key={card.id} card={card} index={index} store={store} />
          ))}
        </Box>
      )}
    </Paper>
  );
});

export default RetroColumn; 