import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Paper, Typography, useMediaQuery } from '@mui/material';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { RetroStore } from '../store/RetroStore';
import RetroColumn from './RetroColumn';
import RetroCard from './RetroCard';
import { getColumnColorStyles } from '../types';
import { useTheme } from '@mui/material/styles';

interface Props {
  store: RetroStore;
}

const RoadmapView: React.FC<Props> = observer(({ store }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:900px)');
  const template = store.templateConfig;
  const roadmapColumns = template.roadmapColumns ?? [];
  const negativeIndexes = template.columns
    .map((column, index) => (column.kind === 'negative' ? index : -1))
    .filter((index) => index >= 0);
  const sourceCards = store.cards.filter((card) => negativeIndexes.includes(card.column));

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const card = store.cards.find((item) => item.id === draggableId);
    if (!card || !store.canMoveCard(card)) return;

    if (destination.droppableId === 'roadmap-source') {
      const origin = card.originColumn;
      const target = origin != null && negativeIndexes.includes(origin) ? origin : negativeIndexes[0];
      if (target == null || target === card.column) return;
      store.socketService?.moveCard(card.id, target);
      return;
    }

    const destinationColumn = Number(destination.droppableId.replace('column-', ''));
    if (Number.isNaN(destinationColumn) || destinationColumn === card.column) return;
    store.socketService?.moveCard(card.id, destinationColumn);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2,
          width: '100%',
          minWidth: 0,
          minHeight: isMobile ? 'auto' : '100%',
          height: isMobile ? 'auto' : '100%',
          alignItems: 'stretch'
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: isMobile ? '100%' : 300,
            flex: isMobile ? '0 0 auto' : '0 0 300px',
            minWidth: isMobile ? 0 : 260,
            p: 1.25,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(20, 24, 40, 0.03)',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="h6" align="center">
            Ещё не в карте
          </Typography>
          <Typography variant="caption" color="text.secondary" align="center">
            Жёлтые и красные карточки. Перетащите их в анализ, эксперимент или результат.
          </Typography>
          <Droppable droppableId="roadmap-source">
            {(provided, snapshot) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  flexGrow: 1,
                  minHeight: 120,
                  borderRadius: 1,
                  bgcolor: snapshot.isDraggingOver ? 'rgba(249, 168, 37, 0.12)' : 'transparent'
                }}
              >
                {sourceCards.length === 0 && (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    Все проблемные карточки уже в дорожной карте
                  </Typography>
                )}
                {sourceCards.map((card, index) => {
                  const accent = getColumnColorStyles(store.getColumnColor(card.column), theme.palette.mode).accent;
                  return (
                    <Draggable key={card.id} draggableId={card.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <Box
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          sx={{ opacity: dragSnapshot.isDragging ? 0.85 : 1 }}
                        >
                          <Box sx={{ px: 0.5, pt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: accent, fontWeight: 700 }}>
                              {store.getColumnTitle(card.column)}
                            </Typography>
                          </Box>
                          <RetroCard card={card} index={index} store={store} />
                        </Box>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </Paper>
        <Box
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 2,
            flex: 1,
            minWidth: 0,
            overflowX: isMobile ? 'visible' : 'auto'
          }}
        >
          {roadmapColumns.map((column, index) => (
            <RetroColumn
              key={column.title}
              columnIndex={template.columns.length + index}
              store={store}
              enableDragDrop
            />
          ))}
        </Box>
      </Box>
    </DragDropContext>
  );
});

export default RoadmapView;
