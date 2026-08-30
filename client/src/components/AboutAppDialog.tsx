import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { APP_CHANGELOG, CURRENT_APP_VERSION } from '../data/appChangelog';

interface Props {
  open: boolean;
  onClose: () => void;
}

const AboutAppDialog: React.FC<Props> = ({ open, onClose }) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="sm"
    fullWidth
    scroll="paper"
    aria-labelledby="about-app-title"
  >
    <DialogTitle
      id="about-app-title"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 1,
        pr: 1
      }}
    >
      <Box>
        <Typography variant="h6" component="span" sx={{ fontWeight: 700, display: 'block' }}>
          О приложении
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Ретроспектива · текущая версия {CURRENT_APP_VERSION.version}
        </Typography>
      </Box>
      <IconButton onClick={onClose} aria-label="Закрыть" size="small">
        <CloseIcon />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ px: 2.5, py: 2 }}>
      {APP_CHANGELOG.map((entry, index) => (
        <Box
          key={entry.version}
          sx={{
            pb: 2.5,
            mb: index === APP_CHANGELOG.length - 1 ? 0 : 2.5,
            borderBottom: index === APP_CHANGELOG.length - 1 ? 0 : 1,
            borderColor: 'divider'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 1,
              mb: 1
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Версия {entry.version}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {entry.date}
            </Typography>
          </Box>
          <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
            {entry.changes.map((change) => (
              <Typography
                key={change}
                component="li"
                variant="body2"
                sx={{ mb: 0.5, '&:last-of-type': { mb: 0 } }}
              >
                {change}
              </Typography>
            ))}
          </Box>
        </Box>
      ))}
    </DialogContent>
    <DialogActions sx={{ px: 2.5, py: 1.5 }}>
      <Button onClick={onClose}>Закрыть</Button>
    </DialogActions>
  </Dialog>
);

export default AboutAppDialog;
