import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ImageIcon from '@mui/icons-material/Image';
import MicIcon from '@mui/icons-material/Mic';

const toolButtonSx = { p: 0.5, opacity: 0.7, '&:hover': { backgroundColor: 'transparent', opacity: 1 } };

interface Props {
  hasContent: boolean;
  hasImage: boolean;
  mediaEnabled: boolean;
  isListening: boolean;
  isSpeechSupported: boolean;
  onEmoji: (anchor: HTMLButtonElement) => void;
  onPickImage: () => void;
  onToggleDictation: () => void;
  onResetOrClose: () => void;
  onSubmit: () => void;
}

const ComposerToolbar: React.FC<Props> = ({
  hasContent,
  hasImage,
  mediaEnabled,
  isListening,
  isSpeechSupported,
  onEmoji,
  onPickImage,
  onToggleDictation,
  onResetOrClose,
  onSubmit
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Tooltip title="Эмодзи">
        <IconButton size="small" aria-label="Эмодзи" onClick={(event) => onEmoji(event.currentTarget)} sx={toolButtonSx}>
          <EmojiEmotionsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Выбрать изображение с диска">
        <span>
          <IconButton
            size="small"
            aria-label="Выбрать изображение с диска"
            onClick={onPickImage}
            color={hasImage ? 'primary' : 'default'}
            sx={toolButtonSx}
            disabled={!mediaEnabled}
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
            onClick={onToggleDictation}
            disabled={!isSpeechSupported}
            color={isListening ? 'error' : 'default'}
            sx={{
              ...toolButtonSx,
              opacity: isListening ? 1 : 0.7,
              animation: isListening ? 'micPulse 1s ease-in-out infinite' : 'none',
              '@keyframes micPulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.15)' }
              }
            }}
          >
            <MicIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Tooltip title={hasContent ? 'Сбросить' : 'Закрыть'}>
        <IconButton size="small" aria-label={hasContent ? 'Сбросить' : 'Закрыть'} onClick={onResetOrClose} sx={{ opacity: 0.7 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Добавить (Enter)">
        <span>
          <IconButton size="small" aria-label="Сохранить" color="primary" onClick={onSubmit} disabled={!hasContent}>
            <CheckIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  </Box>
);

export default ComposerToolbar;
