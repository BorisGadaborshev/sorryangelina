import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { keyframes } from '@emotion/react';
import { Box, Paper, Typography, IconButton, Tooltip, Button, Popover, useMediaQuery } from '@mui/material';
import NavigateBefore from '@mui/icons-material/NavigateBefore';
import NavigateNext from '@mui/icons-material/NavigateNext';
import { useTheme } from '@mui/material/styles';
import { RetroStore } from '../store/RetroStore';
import { Card as CardType, DISCUSSION_BURST_OPTIONS, DiscussionNavigationState, getCardTextSegments, getColumnColorStyles } from '../types';
import RetroCard from './RetroCard';
import { VoteIcon } from './VoteIcon';
import { safeMediaSrc } from '../utils/media';

interface Props {
  store: RetroStore;
}

const discussionFloat = keyframes`
  0% { transform: translate3d(0, 24px, 0) scale(0.35); opacity: 0; }
  14% { transform: translate3d(0, 0, 0) scale(1.12); opacity: 1; }
  100% { transform: translate3d(var(--drift), -460px, 0) scale(0.92); opacity: 0; }
`;

interface FloatingEmoji {
  id: string;
  emoji: string;
  left: number;
  duration: number;
  drift: number;
  size: number;
}

const formatPersonShortName = (fullName: string): string => {
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

const RaisedHandsCorner: React.FC<{ names: string[] }> = ({ names }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:600px)');
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [useShortNames, setUseShortNames] = useState(false);
  const fullLabel = names.join(', ');
  const shortLabel = names.map(formatPersonShortName).join(', ');

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure || names.length === 0) {
      setUseShortNames(false);
      return;
    }

    const update = () => {
      setUseShortNames(measure.scrollWidth > container.clientWidth + 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fullLabel, isMobile, names.length]);

  if (names.length === 0) return null;

  return (
    <Tooltip title={fullLabel}>
      <Box
        ref={containerRef}
        sx={{
          position: 'absolute',
          zIndex: 6,
          top: 8,
          right: 12,
          left: isMobile ? 12 : 'auto',
          width: isMobile ? 'auto' : 'max-content',
          maxWidth: isMobile ? 'none' : '46%',
          textAlign: isMobile ? 'center' : 'right',
          pointerEvents: 'auto'
        }}
      >
        <Typography
          component="span"
          ref={measureRef}
          variant="body2"
          sx={{
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontWeight: 700
          }}
        >
          ✋ {fullLabel}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            px: 1,
            py: 0.4,
            borderRadius: 999,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.86)'
          }}
        >
          ✋ {useShortNames ? shortLabel : fullLabel}
        </Typography>
      </Box>
    </Tooltip>
  );
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
  const showDiscussionActions = features.discussionActionsEnabled;
  const facilitatorName = store.facilitatorAnnouncement?.userName?.trim() || '';
  const facilitatorShortName = useMemo(
    () => (facilitatorName ? formatPersonShortName(facilitatorName) : ''),
    [facilitatorName]
  );
  const facilitatorLabelRef = useRef<HTMLDivElement>(null);
  const facilitatorMeasureRef = useRef<HTMLSpanElement>(null);
  const [useShortFacilitatorName, setUseShortFacilitatorName] = useState(false);
  const [reactionAnchorEl, setReactionAnchorEl] = useState<HTMLElement | null>(null);
  const [particles, setParticles] = useState<FloatingEmoji[]>([]);
  const seenBurstIds = useRef(new Set<string>());
  const burstsPrimed = useRef(false);
  const bursts = store.discussionBursts;
  const myName = store.currentUser?.name || '';
  const handRaised = myName ? store.discussionHands.includes(myName) : false;

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

  useEffect(() => {
    if (!burstsPrimed.current) {
      bursts.forEach((burst) => seenBurstIds.current.add(burst.id));
      burstsPrimed.current = true;
      return;
    }

    if (seenBurstIds.current.size > 80) {
      const live = new Set(bursts.map((burst) => burst.id));
      seenBurstIds.current.forEach((id) => {
        if (!live.has(id)) seenBurstIds.current.delete(id);
      });
    }

    const fresh = bursts.filter((burst) => !seenBurstIds.current.has(burst.id));
    if (fresh.length === 0) return;

    const spawned: FloatingEmoji[] = [];
    fresh.forEach((burst) => {
      seenBurstIds.current.add(burst.id);
      const count = burst.emoji === '✋' || burst.emoji === '✍️' ? 1 : 4;
      for (let index = 0; index < count; index += 1) {
        spawned.push({
          id: `${burst.id}-${index}`,
          emoji: burst.emoji,
          left: 8 + Math.random() * 84,
          duration: 2300 + Math.random() * 1200,
          drift: Math.round((Math.random() - 0.5) * 110),
          size: count === 1 ? 64 : 32 + Math.round(Math.random() * 26)
        });
      }
    });

    setParticles((current) => [...current, ...spawned].slice(-48));
  }, [bursts]);

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
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%'
      }}>
        {showDiscussionActions && <RaisedHandsCorner names={store.discussionHands} />}
        <Typography variant="h6">Все карточки просмотрены</Typography>
      </Box>
    );
  }

  const isCurrentCardAuthor = Boolean(myName && currentCard.createdBy === myName);
  const authorRevealed = Boolean(currentCard.authorRevealed);

  return (
    <Box sx={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      p: 3
    }}>
      {showDiscussionActions && <RaisedHandsCorner names={store.discussionHands} />}
      <Box aria-hidden sx={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 4, overflow: 'hidden' }}>
        {particles.map((particle) => (
          <Box
            key={particle.id}
            onAnimationEnd={() => {
              setParticles((current) => current.filter((item) => item.id !== particle.id));
            }}
            style={{
              left: `${particle.left}%`,
              fontSize: particle.size,
              ['--drift' as string]: `${particle.drift}px`
            }}
            sx={{
              position: 'absolute',
              bottom: '8%',
              lineHeight: 1,
              animation: `${discussionFloat} ${particle.duration}ms ease-out forwards`
            }}
          >
            {particle.emoji}
          </Box>
        ))}
      </Box>
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

        {showDiscussionActions && <Box sx={{ order: 2, width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Реакции">
              <Button
                aria-label="Реакции"
                aria-expanded={Boolean(reactionAnchorEl)}
                onClick={(event) => setReactionAnchorEl(event.currentTarget)}
                sx={{
                  minWidth: 48,
                  minHeight: 40,
                  px: 1.25,
                  borderRadius: '10px',
                  fontSize: 22,
                  lineHeight: 1,
                  color: '#fff',
                  backgroundImage: 'linear-gradient(135deg, #766dff 0%, #5b54e8 100%)',
                  boxShadow: '0 4px 12px rgba(92, 84, 232, 0.3)',
                  '&:hover': {
                    color: '#fff',
                    backgroundImage: 'linear-gradient(135deg, #827aff 0%, #655df0 100%)'
                  }
                }}
              >
                😊
              </Button>
            </Tooltip>
            <Popover
              open={Boolean(reactionAnchorEl)}
              anchorEl={reactionAnchorEl}
              onClose={() => setReactionAnchorEl(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 0.5,
                  p: 1
                }}
              >
                {DISCUSSION_BURST_OPTIONS.map(({ emoji, label }) => (
                  <Tooltip key={emoji} title={label}>
                    <IconButton
                      aria-label={label}
                      onClick={() => {
                        store.socketService?.sendDiscussionBurst(emoji);
                        setReactionAnchorEl(null);
                      }}
                      sx={{
                        width: 44,
                        height: 44,
                        fontSize: 24
                      }}
                    >
                      {emoji}
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            </Popover>
            <Tooltip title={handRaised ? 'Отпустить руку' : 'Поднять руку'}>
              <Button
                aria-label={handRaised ? 'Отпустить руку' : 'Поднять руку'}
                aria-pressed={handRaised}
                onClick={() => store.socketService?.toggleDiscussionHand()}
                sx={{
                  minWidth: 48,
                  minHeight: 40,
                  px: 1.25,
                  borderRadius: '10px',
                  fontSize: 22,
                  lineHeight: 1,
                  color: handRaised ? '#1f1f1f' : '#fff',
                  backgroundImage: handRaised
                    ? 'linear-gradient(135deg, #ffd56a 0%, #f0a202 100%)'
                    : 'linear-gradient(135deg, #766dff 0%, #5b54e8 100%)',
                  boxShadow: handRaised
                    ? '0 4px 12px rgba(240, 162, 2, 0.28)'
                    : '0 4px 12px rgba(92, 84, 232, 0.3)',
                  '&:hover': {
                    color: handRaised ? '#1f1f1f' : '#fff',
                    backgroundImage: handRaised
                      ? 'linear-gradient(135deg, #ffe08a 0%, #f5b020 100%)'
                      : 'linear-gradient(135deg, #827aff 0%, #655df0 100%)'
                  }
                }}
              >
                ✋
              </Button>
            </Tooltip>
            {isCurrentCardAuthor && (
              <Tooltip title={authorRevealed ? 'Скрыть, что вы автор' : 'Я автор'}>
                <Button
                  aria-label={authorRevealed ? 'Скрыть, что вы автор' : 'Я автор'}
                  aria-pressed={authorRevealed}
                  onClick={() => store.socketService?.setCardAuthorReveal(currentCard.id, !authorRevealed)}
                  sx={{
                    minWidth: 48,
                    minHeight: 40,
                    px: 1.25,
                    borderRadius: '10px',
                    fontSize: 22,
                    lineHeight: 1,
                    color: '#fff',
                    backgroundImage: authorRevealed
                      ? 'linear-gradient(135deg, #38c976 0%, #22a95c 100%)'
                      : 'linear-gradient(135deg, #5c6b7a 0%, #3d4b59 100%)',
                    boxShadow: authorRevealed
                      ? '0 4px 12px rgba(34, 169, 92, 0.28)'
                      : '0 4px 12px rgba(61, 75, 89, 0.28)',
                    '&:hover': {
                      color: '#fff',
                      backgroundImage: authorRevealed
                        ? 'linear-gradient(135deg, #42d580 0%, #29b866 100%)'
                        : 'linear-gradient(135deg, #6b7b8b 0%, #4a5968 100%)'
                    }
                  }}
                >
                  ✍️
                </Button>
              </Tooltip>
            )}
          </Box>
        </Box>}

        <Box sx={{ order: 1, width: '100%', maxWidth: '900px' }}>
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
                  {safeMediaSrc(card.imageUrl) && (
                    <Box
                      component="img"
                      src={safeMediaSrc(card.imageUrl)}
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
                    {card.authorRevealed && card.createdBy && (
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        Автор: {card.createdBy}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                        <VoteIcon type="like" id={features.likeIcon} size={14} />
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                          {card.likes?.length || 0}
                        </Typography>
                      </Box>
                      {showDislikes && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                          <VoteIcon type="dislike" id={features.dislikeIcon} size={14} />
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
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
