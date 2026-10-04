import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Paper, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { RetroStore } from '../store/RetroStore';
import { getCardTypeByColumn, getColumnColorStyles } from '../types';
import CardComposer from './column/CardComposer';
import ColumnCards from './column/ColumnCards';
import ColumnHeader from './column/ColumnHeader';

interface Props {
  columnIndex: number;
  store: RetroStore;
  enableDragDrop?: boolean;
  onAddCardStart?: () => void;
}

const RetroColumn: React.FC<Props> = observer(({ columnIndex, store, enableDragDrop = false, onAddCardStart }) => {
  const isMobile = useMediaQuery('(max-width:600px)');
  const theme = useTheme();
  const cards = store.cardsInColumn(columnIndex);
  const columnThemeColors = getColumnColorStyles(store.getColumnColor(columnIndex), theme.palette.mode);

  return (
    <Paper
      elevation={0}
      sx={{
        width: isMobile ? '100%' : 'auto',
        maxWidth: '100%',
        flex: isMobile ? '0 0 auto' : '1 1 220px',
        minWidth: isMobile ? 0 : 220,
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
      <ColumnHeader store={store} columnIndex={columnIndex} cards={cards} accent={columnThemeColors.accent} />
      <Box sx={{ height: 4, borderRadius: 999, backgroundColor: columnThemeColors.accent, mb: 0.5 }} />

      {store.canComposeInColumn(columnIndex) && (
        <CardComposer
          store={store}
          columnIndex={columnIndex}
          cardType={getCardTypeByColumn(store.templateConfig, columnIndex)}
          accent={columnThemeColors.accent}
          fill={columnThemeColors.fill}
          hint={store.getColumnHint(columnIndex)}
          onAddCardStart={onAddCardStart}
        />
      )}

      <ColumnCards store={store} columnIndex={columnIndex} cards={cards} enableDragDrop={enableDragDrop} />
    </Paper>
  );
});

export default RetroColumn;
