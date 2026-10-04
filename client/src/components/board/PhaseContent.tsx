import React, { lazy, Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, CircularProgress } from '@mui/material';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { RetroStore } from '../../store/RetroStore';
import ErrorBoundary from '../ErrorBoundary';
import RetroColumn from '../RetroColumn';

const DiscussionView = lazy(() => import('../DiscussionView'));
const RetroRatingView = lazy(() => import('../RetroRatingView'));
const RoadmapView = lazy(() => import('../RoadmapView'));

interface Props {
  store: RetroStore;
  isMobile: boolean;
  onAddCardStart: () => void;
}

const BoardColumns: React.FC<Props> = observer(({ store, isMobile, onAddCardStart }) => {
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, combine } = result;
    if (store.phase !== 'creation') return;
    const draggedCard = store.cards.find((card) => card.id === draggableId);
    if (!draggedCard || !store.canMoveCard(draggedCard)) return;

    if (combine) {
      if (!store.canMergeCards || combine.draggableId === draggableId) return;
      store.socketService?.mergeCards(combine.draggableId, draggableId);
      return;
    }

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const destinationColumn = Number(destination.droppableId.replace('column-', ''));
    if (Number.isNaN(destinationColumn)) return;

    store.socketService?.moveCard(draggableId, destinationColumn);
  };

  const columns = (
    <Box sx={{ width: '100%', minWidth: 0, height: isMobile ? 'auto' : '100%', overflowX: isMobile ? 'visible' : 'auto' }}>
      <Box sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 2,
        width: '100%',
        minWidth: isMobile ? 0 : 'min-content',
        minHeight: isMobile ? 'auto' : '100%',
        height: 'auto',
        alignItems: 'stretch',
      }}>
        {store.templateConfig.columns.map((column, columnIndex) => (
          <RetroColumn
            key={columnIndex}
            columnIndex={columnIndex}
            store={store}
            enableDragDrop={store.canUseCardDragDrop}
            onAddCardStart={onAddCardStart}
          />
        ))}
      </Box>
    </Box>
  );

  if (!store.canUseCardDragDrop) {
    return columns;
  }

  return <DragDropContext onDragEnd={handleDragEnd}>{columns}</DragDropContext>;
});

const PhaseContent: React.FC<Props> = observer((props) => {
  const { store } = props;
  let phaseView: React.ReactNode;
  switch (store.phase) {
    case 'discussion':
      phaseView = <DiscussionView store={store} />;
      break;
    case 'roadmap':
      phaseView = <RoadmapView store={store} />;
      break;
    case 'rating':
      phaseView = <RetroRatingView store={store} />;
      break;
    case 'creation':
    case 'voting':
    default:
      phaseView = <BoardColumns {...props} />;
  }
  return (
    <ErrorBoundary title="Доску не удалось показать">
      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={28} /></Box>}>
        {phaseView}
      </Suspense>
    </ErrorBoundary>
  );
});

export default PhaseContent;
