import React from 'react';
import { observer } from 'mobx-react-lite';
import { Box } from '@mui/material';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { RetroStore } from '../../store/RetroStore';
import { Card } from '../../types';
import RetroCard from '../RetroCard';

interface Props {
  store: RetroStore;
  columnIndex: number;
  cards: Card[];
  enableDragDrop: boolean;
}

const ColumnCards: React.FC<Props> = observer(({ store, columnIndex, cards, enableDragDrop }) => {
  if (!enableDragDrop) {
    return (
      <Box sx={{ flexGrow: 1, minHeight: 0, minWidth: 0, maxWidth: '100%', overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
        {cards.map((card, index) => (
          <RetroCard key={card.id} card={card} index={index} store={store} />
        ))}
      </Box>
    );
  }

  return (
    <Droppable droppableId={`column-${columnIndex}`} isCombineEnabled={store.canMergeCards}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          {...provided.droppableProps}
          sx={{
            flexGrow: 1,
            minHeight: 0,
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 1,
            backgroundColor: snapshot.isDraggingOver ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
            transition: 'background-color 0.2s ease'
          }}
        >
          {cards.map((card, index) => (
            <Draggable key={card.id} draggableId={card.id} index={index} isDragDisabled={!store.canMoveCard(card)}>
              {(dragProvided, dragSnapshot) => (
                <Box
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  {...dragProvided.dragHandleProps}
                  sx={{
                    opacity: dragSnapshot.isDragging ? 0.85 : 1,
                    minWidth: 0,
                    maxWidth: '100%'
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
  );
});

export default ColumnCards;
