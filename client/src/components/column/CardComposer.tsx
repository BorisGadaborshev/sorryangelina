import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, IconButton, Popover, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { RetroStore } from '../../store/RetroStore';
import { CardType } from '../../types';
import { cardDraftKey } from '../../services/session';
import { fileToImageDataUrl, IMAGE_FILE_ACCEPT, safeMediaSrc } from '../../utils/media';
import ComposerToolbar from './ComposerToolbar';
import { useDictation } from './useDictation';

const EMOJI_GROUPS: Record<CardType, string[]> = {
  liked: [
    '😊', '🎉', '👍', '⭐', '🌟', '💪', '🙌', '👏', '✨', '🎯',
    '❤️', '🥰', '😍', '🤩', '😇', '🥳', '🔥', '💯', '👌', '💖',
    '💝', '💫', '🌈', '🎨', '🎭', '🎪', '🎡', '🎢', '🎠', '🎬'
  ],
  disliked: [
    '😕', '😢', '😩', '😫', '😤', '😠', '😡', '💔', '⚠️', '❌',
    '😞', '😔', '😣', '😖', '😨', '😰', '😥', '😪', '😓', '😭',
    '🤔', '🤨', '😒', '🙄', '😑', '😐', '😶', '🤦', '🤷', '💩'
  ],
  suggestion: [
    '💡', '🎨', '🔧', '🛠️', '📝', '✏️', '🎯', '🎪', '🎭', '🎬',
    '📌', '📍', '💭', '🗯️', '💬', '📢', '🔍', '⚡', '💫', '🌟',
    '🎵', '🎶', '📱', '💻', '⌨️', '🖥️', '🎮', '🎲', '🔮', '✨'
  ]
};

const extractPastedImageUrl = (pasted: string): { url: string; leftover: string } | null => {
  const match = pasted.match(/https?:\/\/[^\s<>"']+/i);
  if (!match || match.index === undefined) return null;
  const url = match[0].replace(/[)\].,;!?]+$/g, '');
  if (!/^https?:\/\//i.test(url)) return null;
  const leftover = `${pasted.slice(0, match.index)}${pasted.slice(match.index + match[0].length)}`.trim();
  return { url, leftover };
};

const withPreview = (base: string, cursor: number, interim: string) => {
  const before = base.slice(0, cursor);
  const after = base.slice(cursor);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  return `${before}${needsSpaceBefore ? ' ' : ''}${interim}${after}`;
};

interface Props {
  store: RetroStore;
  columnIndex: number;
  cardType: CardType;
  accent: string;
  fill?: string;
  hint?: string;
  onAddCardStart?: () => void;
}

const CardComposer: React.FC<Props> = observer(({ store, columnIndex, cardType, accent, fill, hint, onAddCardStart }) => {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePickError, setImagePickError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef(text);
  const cursorRef = useRef(cursorPosition);
  const draftKey = store.room?.id ? cardDraftKey(store.room.id, columnIndex) : null;
  const canAddCards = store.canAddCards(columnIndex);
  const canCreateCard = canAddCards && !store.isCardLimitReached;
  const hasContent = Boolean(text.trim() || imageUrl.trim());

  const focusAt = (position?: number) => {
    setTimeout(() => {
      if (!textFieldRef.current) return;
      textFieldRef.current.focus();
      if (position !== undefined) textFieldRef.current.setSelectionRange(position, position);
    }, 0);
  };

  const replaceText = (nextText: string, nextCursor: number) => {
    textRef.current = nextText;
    cursorRef.current = nextCursor;
    setText(nextText);
    setCursorPosition(nextCursor);
    focusAt(nextCursor);
  };

  const insertDictation = (transcript: string) => {
    const cleaned = transcript.trim();
    if (!cleaned) return;
    const start = cursorRef.current;
    const before = textRef.current.slice(0, start);
    const after = textRef.current.slice(start);
    const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
    const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
    const piece = `${needsSpaceBefore ? ' ' : ''}${cleaned}${needsSpaceAfter ? ' ' : ''}`;
    replaceText(before + piece + after, start + piece.length);
  };

  const dictation = useDictation({
    onFinal: insertDictation,
    onStart: () => textFieldRef.current?.focus()
  });

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    cursorRef.current = cursorPosition;
  }, [cursorPosition]);

  useEffect(() => {
    if (!draftKey) return;
    const raw = sessionStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { text?: string; imageUrl?: string };
      if (parsed.text) {
        textRef.current = parsed.text;
        setText(parsed.text);
      }
      const imageSrc = safeMediaSrc(parsed.imageUrl);
      if (imageSrc && !imageSrc.startsWith('data:')) setImageUrl(parsed.imageUrl || '');
    } catch {
      sessionStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const timeoutId = window.setTimeout(() => {
      if (!text.trim() && !imageUrl.trim()) {
        sessionStorage.removeItem(draftKey);
        return;
      }
      const storedImageUrl = imageUrl.startsWith('data:') ? '' : imageUrl.trim();
      sessionStorage.setItem(draftKey, JSON.stringify({ text, imageUrl: storedImageUrl }));
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [draftKey, imageUrl, text]);

  useEffect(() => {
    if (!isOpen) {
      dictation.stop();
      dictation.setError(null);
      dictation.setInterim('');
      setEmojiAnchorEl(null);
      return;
    }
    const focusTimer = window.setTimeout(() => {
      textFieldRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    if (!canAddCards) {
      setIsOpen(false);
    }
  }, [canAddCards]);

  const displayedText = useMemo(() => {
    if (!dictation.isListening || !dictation.interim) return text;
    return withPreview(text, cursorPosition, dictation.interim);
  }, [cursorPosition, dictation.interim, dictation.isListening, text]);

  const resetInput = () => {
    dictation.stop();
    setText('');
    setImageUrl('');
    setImagePickError('');
    dictation.setError(null);
    dictation.setInterim('');
    textRef.current = '';
    cursorRef.current = 0;
    focusAt();
  };

  const resetOrClose = () => {
    if (!hasContent) {
      resetInput();
      setIsOpen(false);
      return;
    }
    resetInput();
  };

  const addCard = () => {
    const trimmed = text.trim();
    const trimmedImage = imageUrl.trim();
    if ((!trimmed && !trimmedImage) || !store.socket || !canAddCards) return;
    if (store.isCardLimitReached) {
      store.setError(store.cardLimitMessage);
      return;
    }
    store.socketService?.addCard(trimmed, cardType, columnIndex, trimmedImage || undefined);
    resetInput();
    setIsOpen(false);
  };

  const selectionRange = () => {
    const start = textFieldRef.current?.selectionStart ?? cursorRef.current;
    const end = textFieldRef.current?.selectionEnd ?? start;
    return { start, end };
  };

  const insertNewline = () => {
    const { start, end } = selectionRange();
    const current = textRef.current;
    replaceText(`${current.slice(0, start)}\n${current.slice(end)}`, start + 1);
  };

  const applyPastedImageUrl = (url: string, leftover: string) => {
    setImageUrl(url);
    const { start, end } = selectionRange();
    const current = textRef.current;
    replaceText(current.slice(0, start) + leftover + current.slice(end), start + leftover.length);
  };

  const insertEmoji = (emoji: string) => {
    const start = cursorPosition;
    setText(text.slice(0, start) + emoji + ' ' + text.slice(start));
    setEmojiAnchorEl(null);
    focusAt(start + emoji.length + 1);
  };

  const trackCursor = (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const position = event.currentTarget.selectionStart ?? 0;
    cursorRef.current = position;
    setCursorPosition(position);
  };

  const selectImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setImageUrl(await fileToImageDataUrl(file));
      setImagePickError('');
    } catch (error) {
      setImagePickError(error instanceof Error ? error.message : 'Не удалось загрузить изображение');
    }
  };

  return (
    <Box sx={{ mb: 0.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
        <Tooltip
          title={
            !canAddCards
              ? 'Только администратор может добавлять карточки в эту колонку'
              : store.isCardLimitReached
                ? store.cardLimitMessage
                : 'Добавить карточку'
          }
        >
          <span>
            <IconButton
              aria-label="Добавить карточку"
              disabled={!canCreateCard}
              onClick={() => {
                if (!canCreateCard) return;
                onAddCardStart?.();
                setIsOpen((open) => !open);
              }}
              sx={{
                position: 'relative',
                zIndex: 4,
                color: accent,
                border: '1px solid',
                borderColor: canCreateCard ? accent : 'action.disabled',
                '&:hover': {
                  borderColor: accent,
                  backgroundColor: fill ?? 'action.hover'
                },
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
      {isOpen && (
        <Box
          sx={{
            mt: 0.75,
            px: 1.25,
            pt: 0.75,
            pb: 0.5,
            borderRadius: 1.5,
            border: '2px solid',
            borderColor: dictation.isListening ? 'error.main' : 'primary.main',
            bgcolor: 'background.paper',
            animation: dictation.isListening ? 'dictationPulse 1.4s ease-in-out infinite' : 'none',
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
            placeholder={hint || 'Напишите что-нибудь...'}
            value={displayedText}
            onChange={(event) => {
              if (dictation.isListening) dictation.setInterim('');
              textRef.current = event.target.value;
              setText(event.target.value);
            }}
            onPaste={(event) => {
              if (!store.roomFeatures.mediaEnabled) return;
              const extracted = extractPastedImageUrl(event.clipboardData.getData('text'));
              if (!extracted) return;
              event.preventDefault();
              applyPastedImageUrl(extracted.url, extracted.leftover);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                resetOrClose();
                return;
              }
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
              if (event.shiftKey) return;
              event.preventDefault();
              if (event.altKey) {
                insertNewline();
                return;
              }
              addCard();
            }}
            inputRef={textFieldRef}
            InputProps={{ disableUnderline: true }}
            inputProps={{
              onClick: trackCursor,
              onKeyUp: trackCursor,
              onSelect: trackCursor
            }}
          />
          {imageUrl.trim() && (
            <Box sx={{ position: 'relative', mt: 0.5 }}>
              <Box
                component="img"
                src={safeMediaSrc(imageUrl)}
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
                  onClick={() => setImageUrl('')}
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
          {dictation.error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5 }}>
              {dictation.error}
            </Typography>
          )}
          {dictation.isListening && (
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
                {dictation.interim
                  ? `Слушаю: «${dictation.interim.trim()}»`
                  : 'Говорите... текст появится в поле выше'}
              </Typography>
            </Box>
          )}
          <ComposerToolbar
            hasContent={hasContent}
            hasImage={Boolean(imageUrl.trim())}
            mediaEnabled={store.roomFeatures.mediaEnabled}
            isListening={dictation.isListening}
            isSpeechSupported={dictation.isSupported}
            onEmoji={setEmojiAnchorEl}
            onPickImage={() => imageInputRef.current?.click()}
            onToggleDictation={dictation.toggle}
            onResetOrClose={resetOrClose}
            onSubmit={addCard}
          />
        </Box>
      )}
      <Popover
        open={Boolean(emojiAnchorEl)}
        anchorEl={emojiAnchorEl}
        onClose={() => setEmojiAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5, maxWidth: '400px' }}>
          {EMOJI_GROUPS[cardType].map((emoji) => (
            <IconButton
              key={emoji}
              onClick={() => insertEmoji(emoji)}
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
        onChange={selectImageFile}
      />
    </Box>
  );
});

export default CardComposer;
