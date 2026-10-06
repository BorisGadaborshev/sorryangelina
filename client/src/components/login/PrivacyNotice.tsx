import React from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';

const PrivacyNotice: React.FC = () => {
  const isDark = useTheme().palette.mode === 'dark';
  return (
    <Box
      role="status"
      sx={{
        position: 'fixed',
        left: { xs: 12, sm: 24 },
        right: { xs: 12, sm: 24 },
        bottom: { xs: 24, sm: 28 },
        zIndex: 1100,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <Paper
        elevation={6}
        sx={{
          pointerEvents: 'auto',
          maxWidth: 720,
          width: '100%',
          px: { xs: 1.75, sm: 2.5 },
          py: { xs: 1.25, sm: 1.5 },
          borderRadius: { xs: 2.5, sm: 3 },
          bgcolor: isDark ? '#f4f4f5' : '#1a1a1a',
          color: isDark ? '#141414' : '#f5f5f5',
          boxShadow: isDark
            ? '0 8px 24px rgba(0, 0, 0, 0.45)'
            : '0 8px 24px rgba(0, 0, 0, 0.22)'
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            lineHeight: { xs: 1.4, sm: 1.5 },
            textAlign: 'center'
          }}
        >
          Настоящий сайт не осуществляет сбор, обработку или хранение персональных данных пользователей, а также не
          использует файлы cookie и не фиксирует IP-адреса посетителей.
        </Typography>
      </Paper>
    </Box>
  );
};

export default PrivacyNotice;
