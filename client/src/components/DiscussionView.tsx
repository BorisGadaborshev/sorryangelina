import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import { NavigateBefore, NavigateNext } from '@mui/icons-material';
import { RetroStore } from '../store/RetroStore';
import { Card as CardType } from '../types';

interface Props {
  store: RetroStore;
}

const DiscussionView: React.FC<Props> = observer(({ store }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);
  const carouselSize = 3;
  const sortedCards = store.sortedCards;

  useEffect(() => {
    setCurrentIndex((prev) => {
      if (sortedCards.length === 0) return 0;
      return Math.min(prev, sortedCards.length - 1);
    });
  }, [sortedCards.length]);

  const remainingCards = useMemo(
    () => sortedCards.filter((_, index) => index !== currentIndex),
    [sortedCards, currentIndex]
  );

  useEffect(() => {
    setCarouselStartIndex((prev) => {
      const maxStart = Math.max(0, remainingCards.length - carouselSize);
      return Math.min(prev, maxStart);
    });
  }, [remainingCards.length]);

  const visibleCarouselCards = remainingCards.slice(carouselStartIndex, carouselStartIndex + carouselSize);
  const canSlideLeft = carouselStartIndex > 0;
  const canSlideRight = carouselStartIndex + carouselSize < remainingCards.length;

  const handleCarouselLeft = () => {
    setCarouselStartIndex((prev) => Math.max(0, prev - 1));
  };

  const handleCarouselRight = () => {
    setCarouselStartIndex((prev) => Math.min(prev + 1, Math.max(0, remainingCards.length - carouselSize)));
  };

  const handleCardSelect = (card: CardType) => {
    const nextIndex = sortedCards.findIndex((current) => current.id === card.id);
    if (nextIndex !== -1) {
      setCurrentIndex(nextIndex);
      setCarouselStartIndex(0);
    }
  };

  const getCardColor = (card: CardType) => {
    return {
      liked: '#e8f5e9',
      disliked: '#ffebee',
      suggestion: '#e3f2fd'
    }[card.type];
  };

  const currentCard = sortedCards[currentIndex];

  if (!currentCard) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100%',
        width: '100%'
      }}>
        <Typography variant="h6">Нет карточек для обсуждения</Typography>
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
        <Typography variant="h6">
          Карточка {currentIndex + 1} из {sortedCards.length}
        </Typography>

        <Paper
          elevation={3}
          sx={{
            width: '100%',
            maxWidth: '600px',
            p: 4,
            backgroundColor: getCardColor(currentCard),
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Предыдущие карточки">
              <span>
                <IconButton onClick={handleCarouselLeft} disabled={!canSlideLeft}>
                  <NavigateBefore />
                </IconButton>
              </span>
            </Tooltip>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, width: '100%' }}>
              {visibleCarouselCards.map((card) => (
                <Paper
                  key={card.id}
                  elevation={2}
                  onClick={() => handleCardSelect(card)}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    minHeight: 120,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: getCardColor(card)
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

            <Tooltip title="Следующие карточки">
              <span>
                <IconButton onClick={handleCarouselRight} disabled={!canSlideRight}>
                  <NavigateNext />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

export default DiscussionView; 