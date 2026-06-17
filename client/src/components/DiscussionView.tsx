import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import { NavigateBefore, NavigateNext } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { RetroStore } from '../store/RetroStore';
import { Card as CardType, DiscussionNavigationState } from '../types';

interface Props {
  store: RetroStore;
}

const DiscussionView: React.FC<Props> = observer(({ store }) => {
  const carouselSize = 3;
  const sortedCards = store.sortedCards;
  const theme = useTheme();
  const canControl = store.canControlDiscussionNavigation();

  const navigation = useMemo<DiscussionNavigationState>(() => {
    const availableIds = sortedCards.map((card) => card.id);
    const source = store.discussionNavigation ?? {
      unviewedCardIds: availableIds,
      viewedCardIds: []
    };

    const unviewedCardIds = source.unviewedCardIds.filter((id) => availableIds.includes(id));
    const viewedCardIds = source.viewedCardIds.filter((id) => availableIds.includes(id));
    const knownIds = new Set([...unviewedCardIds, ...viewedCardIds]);
    const appended = availableIds.filter((id) => !knownIds.has(id));

    return {
      unviewedCardIds: [...unviewedCardIds, ...appended],
      viewedCardIds
    };
  }, [sortedCards, store.discussionNavigation]);

  const cardsById = useMemo(
    () => new Map(sortedCards.map((card) => [card.id, card])),
    [sortedCards]
  );

  const unviewedCards = useMemo(
    () => navigation.unviewedCardIds.map((id) => cardsById.get(id)).filter(Boolean) as CardType[],
    [navigation.unviewedCardIds, cardsById]
  );

  const currentCard = unviewedCards[0];
  const remainingCards = unviewedCards.slice(1);
  const visibleCarouselCards = remainingCards.slice(0, carouselSize);

  const publishNavigation = (next: DiscussionNavigationState) => {
    if (!canControl) return;
    store.socketService?.setDiscussionNavigation(next);
  };

  const handleNextCard = () => {
    if (!currentCard || !canControl) return;
    publishNavigation({
      viewedCardIds: [...navigation.viewedCardIds, currentCard.id],
      unviewedCardIds: navigation.unviewedCardIds.slice(1)
    });
  };

  const handlePreviousCard = () => {
    if (!canControl || navigation.viewedCardIds.length === 0) return;
    const previousCardId = navigation.viewedCardIds[navigation.viewedCardIds.length - 1];
    publishNavigation({
      viewedCardIds: navigation.viewedCardIds.slice(0, -1),
      unviewedCardIds: [previousCardId, ...navigation.unviewedCardIds]
    });
  };

  const handleCardSelect = (card: CardType) => {
    if (!canControl) return;
    const index = navigation.unviewedCardIds.indexOf(card.id);
    if (index <= 0) return;
    publishNavigation({
      ...navigation,
      unviewedCardIds: [
        card.id,
        ...navigation.unviewedCardIds.slice(0, index),
        ...navigation.unviewedCardIds.slice(index + 1)
      ]
    });
  };

  const getCardColor = (card: CardType) => {
    if (theme.palette.mode === 'dark') {
      return {
        liked: '#28372d',
        disliked: '#3a2b30',
        suggestion: '#253344'
      }[card.type];
    }
    return {
      liked: '#b2dfdb',
      disliked: '#f8bbd0',
      suggestion: '#e1bee7'
    }[card.type];
  };

  if (!currentCard) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%'
      }}>
        <Typography variant="h6">Все карточки просмотрены</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      p: 3
    }}>
      <Box sx={{
        maxWidth: '800px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4
      }}>
        <Box sx={{ width: '100%', maxWidth: '600px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tooltip title={canControl ? 'Вернуть предыдущую карточку' : 'Переключением управляет фасилитатор'}>
            <span>
              <IconButton onClick={handlePreviousCard} disabled={!canControl || navigation.viewedCardIds.length === 0}>
                <NavigateBefore />
              </IconButton>
            </span>
          </Tooltip>
          <Typography variant="h6">
            Осталось {unviewedCards.length} из {sortedCards.length}
          </Typography>
          <Tooltip title={canControl ? 'Следующая карточка' : 'Переключением управляет фасилитатор'}>
            <span>
              <IconButton onClick={handleNextCard} disabled={!canControl || !currentCard}>
                <NavigateNext />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {!canControl && store.facilitatorAnnouncement && (
          <Typography variant="body2" color="text.secondary">
            Карточки переключает {store.facilitatorAnnouncement.userName}
          </Typography>
        )}

        <Paper
          elevation={3}
          sx={{
            width: '100%',
            maxWidth: '600px',
            p: 4,
            backgroundColor: getCardColor(currentCard),
            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.92)' : 'inherit',
            minHeight: '250px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3
          }}
        >
          <Typography
            variant="body1"
            sx={{
              flexGrow: 1,
              fontSize: '1.1rem',
              lineHeight: 1.6
            }}
          >
            {currentCard.text}
          </Typography>
          {currentCard.imageUrl && (
            <Box
              component="img"
              src={currentCard.imageUrl}
              alt="card"
              sx={{
                width: '100%',
                maxHeight: 320,
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid rgba(0,0,0,0.08)'
              }}
            />
          )}

          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(0,0,0,0.1)',
            pt: 2
          }}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Typography variant="body2" color="primary" sx={{ fontSize: '1rem' }}>
                🍑 {currentCard.likes?.length || 0}
              </Typography>
              <Typography variant="body2" color="error" sx={{ fontSize: '1rem' }}>
                🍅 {currentCard.dislikes?.length || 0}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1rem' }}>
              Рейтинг: {(currentCard.likes?.length || 0) - (currentCard.dislikes?.length || 0)}
            </Typography>
          </Box>
        </Paper>

        <Box sx={{ width: '100%', maxWidth: '900px' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Остальные карточки
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, width: '100%' }}>
            {visibleCarouselCards.map((card) => (
              <Paper
                key={card.id}
                elevation={2}
                onClick={() => handleCardSelect(card)}
                sx={{
                  p: 1.5,
                  cursor: canControl ? 'pointer' : 'default',
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  backgroundColor: getCardColor(card),
                  color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.92)' : 'inherit',
                  opacity: canControl ? 1 : 0.92
                }}
              >
                <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {card.text}
                </Typography>
                {card.imageUrl && (
                  <Box
                    component="img"
                    src={card.imageUrl}
                    alt="thumb"
                    sx={{
                      width: '100%',
                      height: 60,
                      objectFit: 'cover',
                      borderRadius: 1
                    }}
                  />
                )}
                <Typography variant="caption" color="text.secondary">
                  🍑 {card.likes?.length || 0} | 🍅 {card.dislikes?.length || 0}
                </Typography>
              </Paper>
            ))}

            {Array.from({ length: Math.max(0, carouselSize - visibleCarouselCards.length) }).map((_, idx) => (
              <Box key={`empty-${idx}`} />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

export default DiscussionView;
