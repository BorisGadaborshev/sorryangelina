import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, TextField, Typography } from '@mui/material';
import { RetroStore } from '../store/RetroStore';

interface Props {
  store: RetroStore;
  compact?: boolean;
}

const ChatTerminal: React.FC<Props> = observer(({ store, compact = false }) => {
  const [draft, setDraft] = useState('');

  const messages = store.chatMessages.slice(-200);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    store.socketService?.sendChatMessage(text);
    setDraft('');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: compact ? 220 : '100%',
        minHeight: compact ? 220 : 260,
        bgcolor: '#0f111a',
        color: '#d7e0ea',
        borderRadius: 1,
        border: '1px solid rgba(255,255,255,0.12)',
        overflow: 'hidden',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      }}
    >
      <Box sx={{ px: 1.25, py: 0.75, borderBottom: '1px solid rgba(255,255,255,0.1)', bgcolor: '#151a26' }}>
        <Typography variant="caption" sx={{ fontFamily: 'inherit', color: '#9bd0a6' }}>
          retro-chat@room:{store.room?.id || '---'}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.25 }}>
        {messages.length === 0 ? (
          <Typography variant="caption" sx={{ color: '#8b93a7', fontFamily: 'inherit' }}>
            {'> Чат пуст. Напишите первое сообщение.'}
          </Typography>
        ) : (
          messages.map((message) => (
            <Box key={message.id} sx={{ mb: 0.75 }}>
              <Typography variant="caption" sx={{ display: 'block', fontFamily: 'inherit', color: '#8b93a7' }}>
                [{new Date(message.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}] {message.userName}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'inherit', wordBreak: 'break-word' }}>
                {`> ${message.text}`}
              </Typography>
            </Box>
          ))
        )}
      </Box>

      <Box sx={{ p: 1, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: '#151a26', display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Введите сообщение..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          InputProps={{
            sx: {
              fontFamily: 'inherit',
              color: '#d7e0ea',
              bgcolor: '#0f111a'
            }
          }}
        />
        <Button variant="contained" onClick={handleSend} disabled={!draft.trim()}>
          Отпр.
        </Button>
      </Box>
    </Box>
  );
});

export default ChatTerminal;
