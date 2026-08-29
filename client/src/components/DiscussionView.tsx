import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import { NavigateBefore, NavigateNext } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { RetroStore } from '../store/RetroStore';
import { Card as CardType, DiscussionNavigationState, getCardTextSegments, getColumnColorStyles } from '../types';
import RetroCard from './RetroCard';
import { VoteIcon } from './VoteIcon';

interface Props {
  store: RetroStore;
}

const formatFacilitatorShortName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName.trim();
  const [surname, ...rest] = parts;
  const initials = rest
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .map((letter) => `${letter.toUpperCase()}.`)
    .join(' ');
  return initials ? `${surname} ${initials}` : surname;
};

const DiscussionView: React.FC<Props> = observer(({ store }) => {
  const carouselSize = 3;
  const sortedCards = store.sortedCards;
  const theme = useTheme();
  const canControl = store.canControlDiscussionNavigation();
  const features = store.roomFeatures;
  const showDislikes = features.dislikesEnabled;
  const showReactions = features.reactionsEnabled;
  const showComments = features.commentsEnabled;
  const facilitatorName = store.facilitatorAnnouncement?.userName?.trim() || '';
  const facilitatorShortName = useMemo(
    () => (facilitatorName ? formatFacilitatorShortName(facilitatorName) : ''),
    [facilitatorName]
  );
  const facilitatorLabelRef = useRef<HTMLDivElement>(null);
  const facilitatorMeasureRef = useRef<HTMLSpanElement>(null);
  const [useShortFacilitatorName, setUseShortFacilitatorName] = useState(false);

  useEffect(() => {
    const container = facilitatorLabelRef.current;
    const measure = facilitatorMeasureRef.current;
    if (!container || !measure || !facilitatorName) {
      setUseShortFacilitatorName(false);
      return;
    }

    const update = () => {
      setUseShortFacilitatorName(measure.scrollWidth > container.clientWidth);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [facilitatorName]);

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

  const getCardColor = (card: CardType) =>
    getColumnColorStyles(store.getColumnColor(card.column), theme.palette.mode).fill;

  const getReactionSummary = (card: CardType): string => {
    const counts = new Map<string, number>();
    (card.reactions || []).forEach((reaction) => {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([emoji, count]) => `${emoji}${count > 1 ? count : ''}`)
      .join(' ');
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
        <Box sx={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          {facilitatorName && (
            <Box
              ref={facilitatorLabelRef}
              sx={{
                width: '100%',
                px: 1,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Typography
                component="span"
                ref={facilitatorMeasureRef}
                variant="subtitle1"
                sx={{
                  position: 'absolute',
                  visibility: 'hidden',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none'
                }}
              >
                Ведущий: {facilitatorName}
              </Typography>
              <Typography
                variant="subtitle1"
                title={facilitatorName}
                sx={{
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Ведущий: {useShortFacilitatorName ? facilitatorShortName : facilitatorName}
              </Typography>
            </Box>
          )}
          <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Tooltip title={canControl ? 'Вернуть предыдущую карточку' : 'Переключением управляет ведущий'}>
              <span>
                <IconButton onClick={handlePreviousCard} disabled={!canControl || navigation.viewedCardIds.length === 0}>
                  <NavigateBefore />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="h6">
              Осталось {unviewedCards.length} из {sortedCards.length}
            </Typography>
            <Tooltip title={canControl ? 'Следующая карточка' : 'Переключением управляет ведущий'}>
              <span>
                <IconButton onClick={handleNextCard} disabled={!canControl || !currentCard}>
                  <NavigateNext />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ width: '100%', maxWidth: '600px' }}>
          <RetroCard card={currentCard} index={0} store={store} />
        </Box>

        <Box sx={{ width: '100%', maxWidth: '900px' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Остальные карточки
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, width: '100%' }}>
            {visibleCarouselCards.map((card) => {
              const reactionSummary = showReactions ? getReactionSummary(card) : '';
              const commentCount = showComments ? (card.comments?.length || 0) : 0;

              return (
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
                  <Box sx={{ overflow: 'hidden' }}>
                    {getCardTextSegments(card.text).map((segment, index) => (
                      <React.Fragment key={`${card.id}-${index}`}>
                        {index > 0 && (
                          <Box
                            sx={{
                              my: 0.75,
                              borderBottom: '1px solid',
                              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'
                            }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {segment}
                        </Typography>
                      </React.Fragment>
                    ))}
                  </Box>
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <VoteIcon type="like" id={features.likeIcon} size={14} />
                        <Typography variant="caption" color="text.secondary">
                          {card.likes?.length || 0}
                        </Typography>
                      </Box>
                      {showDislikes && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <VoteIcon type="dislike" id={features.dislikeIcon} size={14} />
                          <Typography variant="caption" color="text.secondary">
                            {card.dislikes?.length || 0}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    {(reactionSummary || commentCount > 0) && (
                      <Typography variant="caption" color="text.secondary">
                        {[reactionSummary, commentCount > 0 ? `💬 ${commentCount}` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}

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
