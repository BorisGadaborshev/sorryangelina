import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { fileToImageDataUrl, IMAGE_FILE_ACCEPT, resolveMediaUrl } from '../utils/media';

interface Props {
  open: boolean;
  currentValue: string;
  onClose: () => void;
  onSave: (value: string) => void;
}

const isValidBackgroundValue = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (/^\/(?:api\/)?uploads\/[a-zA-Z0-9._-]+$/.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const BackgroundImageDialog: React.FC<Props> = ({ open, currentValue, onClose, onSave }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const isRemoteUrl = currentValue.startsWith('http://') || currentValue.startsWith('https://');
    setUrlDraft(isRemoteUrl ? currentValue : '');
    setPreview(currentValue);
    setError('');
  }, [open, currentValue]);

  const applyPreview = (value: string) => {
    const trimmed = value.trim();
    setPreview(trimmed);
    if (!trimmed) {
      setError('');
      return;
    }
    setError(isValidBackgroundValue(trimmed) ? '' : 'Вставьте ссылку на изображение (http/https) или выберите файл');
  };

  const handleSelectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const result = await fileToImageDataUrl(file);
      setUrlDraft('');
      setPreview(result);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось прочитать файл');
    }
  };

  const handleSave = () => {
    const next = preview.trim();
    if (!next) {
      onSave('');
      onClose();
      return;
    }
    if (!isValidBackgroundValue(next)) {
      setError('Вставьте корректную ссылку или выберите файл');
      return;
    }
    onSave(next);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          pr: 1
        }}
      >
        Фон доски
        <IconButton onClick={onClose} aria-label="Закрыть" size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Вставьте ссылку на картинку или выберите файл с компьютера. Фон увидят все участники комнаты.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Ссылка на изображение"
          placeholder="https://..."
          value={urlDraft}
          onChange={(event) => {
            const value = event.target.value;
            setUrlDraft(value);
            applyPreview(value);
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
            Выбрать файл
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_FILE_ACCEPT}
            hidden
            onChange={handleSelectFile}
          />
        </Box>
        {error && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            {error}
          </Typography>
        )}
        {preview && (
          <Box
            component="img"
            src={resolveMediaUrl(preview)}
            alt="Предпросмотр фона"
            referrerPolicy="no-referrer"
            onError={() => {
              if (isValidBackgroundValue(preview)) return;
              setError('Не удалось загрузить изображение');
            }}
            sx={{
              display: 'block',
              width: '100%',
              maxHeight: 220,
              objectFit: 'cover',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              mt: 1.5
            }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          color="inherit"
          onClick={() => {
            setUrlDraft('');
            setPreview('');
            setError('');
          }}
          disabled={!preview}
        >
          Убрать
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleSave} disabled={Boolean(error) && !isValidBackgroundValue(preview)}>
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BackgroundImageDialog;
