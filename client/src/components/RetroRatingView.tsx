import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, LinearProgress, Paper, Radio, Step, StepLabel, Stepper, Typography, useMediaQuery, useTheme } from '@mui/material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { RetroStore } from '../store/RetroStore';
import { ArkanoidScoreEntry, Card, ChatMessage, ColumnKind, Mood, RetroTemplate, User, getCardTextSegments, getTemplateColumn } from '../types';

interface Props {
  store: RetroStore;
}

type RatingOption = {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  bgcolor: string;
  color: string;
  barColor: string;
};

const LIGHT_RATING_OPTIONS: RatingOption[] = [
  { value: 1, label: 'Определенно не стоит нашего времени', bgcolor: '#f8fafc', color: '#1a1a1a', barColor: '#94a3b8' },
  { value: 2, label: 'Вероятно, не стоит нашего времени', bgcolor: '#e4e7ef', color: '#1a1a1a', barColor: '#a8b0c2' },
  { value: 3, label: 'Стоит нашего времени', bgcolor: '#9be7c6', color: '#0f3d2e', barColor: '#5fd6a4' },
  { value: 4, label: 'Хорошее использование нашего времени', bgcolor: '#12d28a', color: '#06251a', barColor: '#12d28a' },
  { value: 5, label: 'Отличное использование нашего времени', bgcolor: '#07bf72', color: '#06251a', barColor: '#07bf72' }
];

const DARK_RATING_OPTIONS: RatingOption[] = [
  { value: 1, label: 'Определенно не стоит нашего времени', bgcolor: '#6b3a3a', color: '#ffe8e8', barColor: '#c97a7a' },
  { value: 2, label: 'Вероятно, не стоит нашего времени', bgcolor: '#5a4f45', color: '#f5ebe2', barColor: '#b39a84' },
  { value: 3, label: 'Стоит нашего времени', bgcolor: '#2f6b56', color: '#dff9ee', barColor: '#5fd6a4' },
  { value: 4, label: 'Хорошее использование нашего времени', bgcolor: '#1f8a62', color: '#e8fff5', barColor: '#2ecf92' },
  { value: 5, label: 'Отличное использование нашего времени', bgcolor: '#12a86e', color: '#f0fff8', barColor: '#07bf72' }
];

const MOOD_LABELS: Record<Mood, string> = {
  great: '😀 Великолепно',
  good: '🙂 Хорошо',
  neutral: '😐 Нормально',
  bad: '🙁 Плохо',
  awful: '😠 Злой'
};

type RetroStat = {
  id: string;
  label: string;
  primary: string;
  secondary?: string;
};

type RetroStatSection = {
  id: string;
  title: string;
  items: RetroStat[];
};

const plural = (count: number, one: string, few: string, many: string): string => {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

const formatNames = (names: string[]): string => {
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'ru'));
  if (sorted.length <= 3) {
    if (sorted.length <= 1) return sorted[0] || '—';
    if (sorted.length === 2) return `${sorted[0]} и ${sorted[1]}`;
    return `${sorted[0]}, ${sorted[1]} и ${sorted[2]}`;
  }
  return `${sorted[0]}, ${sorted[1]} и ещё ${sorted.length - 2}`;
};

const bump = (map: Map<string, number>, key: string | undefined, by = 1) => {
  const name = key?.trim();
  if (!name || by === 0) return;
  map.set(name, (map.get(name) || 0) + by);
};

const seedZeros = (names: string[]): Map<string, number> => {
  const map = new Map<string, number>();
  names.forEach((name) => {
    const trimmed = name.trim();
    if (trimmed) map.set(trimmed, 0);
  });
  return map;
};

const pickExtreme = (map: Map<string, number>, mode: 'max' | 'min'): { names: string[]; count: number } | null => {
  if (map.size === 0) return null;
  let max = Number.NEGATIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  map.forEach((count) => {
    if (count > max) max = count;
    if (count < min) min = count;
  });
  const target = mode === 'max' ? max : min;
  if (mode === 'max' && target <= 0) return null;
  if (mode === 'min' && max === min) return null;
  const names: string[] = [];
  map.forEach((count, name) => {
    if (count === target) names.push(name);
  });
  return names.length > 0 ? { names, count: target } : null;
};

const cardPreview = (card: Card): string => {
  const text = getCardTextSegments(card.text).join(' — ').replace(/\s+/g, ' ').trim();
  if (!text) return card.imageUrl ? 'Карточка с изображением' : 'Пустая карточка';
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
};

const columnKind = (card: Card, template: RetroTemplate): ColumnKind => {
  const column = getTemplateColumn(template, card.column);
  if (column) return column.kind;
  if (card.type === 'disliked') return 'negative';
  if (card.type === 'suggestion') return 'suggestion';
  return 'positive';
};

const kindStatLabel = (prefix: string, template: RetroTemplate, columnTitles: string[], kind: ColumnKind): string => {
  const titles = template.columns
    .map((column, index) => columnTitles[index] || column.title)
    .filter((_, index) => template.columns[index].kind === kind);
  const useGenericName = titles.length !== 1 && (titles.length === 0 || (kind === 'negative' && template.actionColumnIndex == null));
  if (useGenericName) return prefix;
  return `${prefix} · ${titles.join(', ')}`;
};

const countLabel = (count: number, one: string, few: string, many: string): string =>
  `${count} ${plural(count, one, few, many)}`;

const buildRetroStatSections = (input: {
  cards: Card[];
  users: User[];
  chatMessages: ChatMessage[];
  columnTitles: string[];
  template: RetroTemplate;
  anonymous: boolean;
  dislikesEnabled: boolean;
  commentsEnabled: boolean;
  reactionsEnabled: boolean;
  chatEnabled: boolean;
  sprintVipName?: string;
  sprintVipVotes?: number;
}): RetroStatSection[] => {
  const {
    cards,
    users,
    chatMessages,
    columnTitles,
    template,
    anonymous,
    dislikesEnabled,
    commentsEnabled,
    reactionsEnabled,
    chatEnabled,
    sprintVipName,
    sprintVipVotes = 0
  } = input;

  const participantNames: string[] = [];
  const userNameById = new Map<string, string>();
  users.forEach((user) => {
    const name = user.name.trim();
    if (name && participantNames.indexOf(name) === -1) participantNames.push(name);
    userNameById.set(user.id, user.name);
  });

  cards.forEach((card) => {
    (card.comments || []).forEach((comment) => {
      if (comment.userId && comment.userName) userNameById.set(comment.userId, comment.userName);
    });
    (card.reactions || []).forEach((reaction) => {
      if (reaction.userId && reaction.userName) userNameById.set(reaction.userId, reaction.userName);
    });
  });

  const cardsCreated = seedZeros(participantNames);
  const positiveCards = new Map<string, number>();
  const negativeCards = new Map<string, number>();
  const suggestionCards = new Map<string, number>();
  const likesReceived = new Map<string, number>();
  const dislikesReceived = new Map<string, number>();
  const commentsReceived = new Map<string, number>();
  const reactionsReceived = new Map<string, number>();
  const likesGiven = seedZeros(participantNames);
  const dislikesGiven = seedZeros(participantNames);
  const commentsWritten = new Map<string, number>();
  const reactionsGiven = new Map<string, number>();
  const chatWritten = new Map<string, number>();
  let totalCastVotes = 0;
  let unnamedCastVotes = 0;

  cards.forEach((card) => {
    bump(cardsCreated, card.createdBy);
    const kind = columnKind(card, template);
    if (kind === 'positive') bump(positiveCards, card.createdBy);
    if (kind === 'negative') bump(negativeCards, card.createdBy);
    if (kind === 'suggestion') bump(suggestionCards, card.createdBy);
    bump(likesReceived, card.createdBy, card.likes?.length || 0);
    bump(dislikesReceived, card.createdBy, card.dislikes?.length || 0);
    bump(commentsReceived, card.createdBy, card.comments?.length || 0);
    bump(reactionsReceived, card.createdBy, card.reactions?.length || 0);
    (card.likes || []).forEach((userId) => {
      totalCastVotes += 1;
      const name = userNameById.get(userId);
      if (!name) unnamedCastVotes += 1;
      else bump(likesGiven, name);
    });
    (card.dislikes || []).forEach((userId) => {
      totalCastVotes += 1;
      const name = userNameById.get(userId);
      if (!name) unnamedCastVotes += 1;
      else bump(dislikesGiven, name);
    });
    (card.comments || []).forEach((comment) => bump(commentsWritten, comment.userName));
    (card.reactions || []).forEach((reaction) => bump(reactionsGiven, reaction.userName));
  });
  chatMessages.forEach((message) => bump(chatWritten, message.userName));

  const votesGiven = seedZeros(participantNames);
  likesGiven.forEach((count, name) => bump(votesGiven, name, count));
  dislikesGiven.forEach((count, name) => bump(votesGiven, name, count));

  const personStat = (
    id: string,
    label: string,
    picked: { names: string[]; count: number } | null,
    unit: [string, string, string]
  ): RetroStat | null => {
    if (!picked) return null;
    return {
      id,
      label,
      primary: formatNames(picked.names),
      secondary: countLabel(picked.count, unit[0], unit[1], unit[2])
    };
  };

  const cardStat = (
    id: string,
    label: string,
    score: (card: Card) => number,
    unit: [string, string, string],
    showAuthor = true
  ): RetroStat | null => {
    let bestScore = 0;
    const best: Card[] = [];
    cards.forEach((card) => {
      const value = score(card);
      if (value <= 0) return;
      if (value > bestScore) {
        bestScore = value;
        best.splice(0, best.length, card);
        return;
      }
      if (value === bestScore) best.push(card);
    });
    if (best.length === 0) return null;
    const author = showAuthor && best.length === 1 ? best[0].createdBy : undefined;
    const extra = best.length > 1 ? `ещё ${best.length - 1} ${plural(best.length - 1, 'карточка', 'карточки', 'карточек')}` : undefined;
    const metric = countLabel(bestScore, unit[0], unit[1], unit[2]);
    return {
      id,
      label,
      primary: cardPreview(best[0]),
      secondary: [author, metric, extra].filter(Boolean).join(' · ')
    };
  };

  const cardItems: RetroStat[] = [
    personStat('most-cards', 'Больше всех карточек', pickExtreme(cardsCreated, 'max'), ['карточка', 'карточки', 'карточек']),
    personStat('most-positive', kindStatLabel('Больше позитивных', template, columnTitles, 'positive'), pickExtreme(positiveCards, 'max'), ['карточка', 'карточки', 'карточек']),
    personStat('most-negative', kindStatLabel('Больше негативных', template, columnTitles, 'negative'), pickExtreme(negativeCards, 'max'), ['карточка', 'карточки', 'карточек']),
    personStat('most-suggestions', kindStatLabel('Больше предложений', template, columnTitles, 'suggestion'), pickExtreme(suggestionCards, 'max'), ['карточка', 'карточки', 'карточек']),
    personStat('least-cards', 'Меньше всех карточек', pickExtreme(cardsCreated, 'min'), ['карточка', 'карточки', 'карточек']),
    personStat('most-likes-received', 'Больше всех лайков получил', pickExtreme(likesReceived, 'max'), ['лайк', 'лайка', 'лайков']),
    dislikesEnabled ? personStat('most-dislikes-received', 'Больше всех дизлайков получил', pickExtreme(dislikesReceived, 'max'), ['дизлайк', 'дизлайка', 'дизлайков']) : null,
    commentsEnabled ? personStat('most-comments-received', 'Больше всех комментариев на карточках', pickExtreme(commentsReceived, 'max'), ['комментарий', 'комментария', 'комментариев']) : null,
    reactionsEnabled ? personStat('most-reactions-received', 'Больше всех реакций получил', pickExtreme(reactionsReceived, 'max'), ['реакция', 'реакции', 'реакций']) : null
  ].filter((item): item is RetroStat => Boolean(item));

  const voteItems: RetroStat[] = [];
  const votesAreNamed = unnamedCastVotes === 0;
  if (votesAreNamed) {
    [
      personStat('most-likes-given', 'Больше всех лайков поставил', pickExtreme(likesGiven, 'max'), ['лайк', 'лайка', 'лайков']),
      dislikesEnabled ? personStat('most-dislikes-given', 'Больше всех дизлайков поставил', pickExtreme(dislikesGiven, 'max'), ['дизлайк', 'дизлайка', 'дизлайков']) : null,
      personStat('most-votes', 'Больше всех голосовал', pickExtreme(votesGiven, 'max'), ['голос', 'голоса', 'голосов']),
      personStat('least-votes', 'Меньше всех голосовал', pickExtreme(votesGiven, 'min'), ['голос', 'голоса', 'голосов'])
    ].forEach((item) => {
      if (item) voteItems.push(item);
    });
  } else if (totalCastVotes > 0) {
    voteItems.push({
      id: 'unnamed-votes',
      label: 'Кто ставил лайки и дизлайки',
      primary: 'Имена не сохранились',
      secondary: `${unnamedCastVotes} из ${totalCastVotes} ${plural(totalCastVotes, 'голос', 'голоса', 'голосов')} не привязаны к имени: их поставили с прошлого подключения`
    });
  }
  [
    cardStat('top-liked-card', 'Самая залайканная карточка', (card) => card.likes?.length || 0, ['лайк', 'лайка', 'лайков'], !anonymous),
    dislikesEnabled ? cardStat('top-disliked-card', 'Самая спорная карточка', (card) => card.dislikes?.length || 0, ['дизлайк', 'дизлайка', 'дизлайков'], !anonymous) : null
  ].forEach((item) => {
    if (item) voteItems.push(item);
  });

  const talkItems: RetroStat[] = [];
  if (commentsEnabled || commentsWritten.size > 0) {
    const comments = personStat('most-comments', 'Больше всех комментирует', pickExtreme(commentsWritten, 'max'), ['комментарий', 'комментария', 'комментариев']);
    if (comments) talkItems.push(comments);
    const discussed = cardStat('top-discussed-card', 'Самая обсуждаемая карточка', (card) => card.comments?.length || 0, ['комментарий', 'комментария', 'комментариев']);
    if (discussed) talkItems.push(discussed);
  }
  if (reactionsEnabled || reactionsGiven.size > 0) {
    const reactions = personStat('most-reactions', 'Больше всех реакций поставил', pickExtreme(reactionsGiven, 'max'), ['реакция', 'реакции', 'реакций']);
    if (reactions) talkItems.push(reactions);
    const reactedCard = cardStat('top-reacted-card', 'Самая реактивная карточка', (card) => card.reactions?.length || 0, ['реакция', 'реакции', 'реакций']);
    if (reactedCard) talkItems.push(reactedCard);
  }
  if (chatEnabled || chatWritten.size > 0) {
    const chat = personStat('most-chat', 'Больше всех пишет в чат', pickExtreme(chatWritten, 'max'), ['сообщение', 'сообщения', 'сообщений']);
    if (chat) talkItems.push(chat);
  }

  const moodCounts = new Map<Mood, number>();
  users.forEach((user) => {
    if (!user.mood) return;
    moodCounts.set(user.mood, (moodCounts.get(user.mood) || 0) + 1);
  });
  if (moodCounts.size > 0) {
    let bestMoodCount = 0;
    moodCounts.forEach((count) => {
      if (count > bestMoodCount) bestMoodCount = count;
    });
    const moods: string[] = [];
    moodCounts.forEach((count, mood) => {
      if (count === bestMoodCount) moods.push(MOOD_LABELS[mood]);
    });
    talkItems.push({
      id: 'mood',
      label: 'Чаще всего настроение',
      primary: moods.join(', '),
      secondary: countLabel(bestMoodCount, 'участник', 'участника', 'участников')
    });
  }

  const engagement = new Map<string, number>();
  const addEngagement = (map: Map<string, number>) => {
    map.forEach((count, name) => bump(engagement, name, count));
  };
  addEngagement(cardsCreated);
  if (unnamedCastVotes === 0) addEngagement(votesGiven);
  addEngagement(commentsWritten);
  addEngagement(reactionsGiven);
  addEngagement(chatWritten);
  const engaged = personStat('most-engaged', 'Самый вовлечённый', pickExtreme(engagement, 'max'), ['действие', 'действия', 'действий']);
  if (engaged) {
    engaged.secondary = `${engaged.secondary} · карточки, голоса, комментарии, реакции и чат`;
    talkItems.push(engaged);
  }

  const vipName = sprintVipName?.trim();
  if (vipName) {
    talkItems.push({
      id: 'sprint-vip',
      label: 'VIP спринта',
      primary: vipName,
      secondary: sprintVipVotes > 0 ? countLabel(sprintVipVotes, 'голос', 'голоса', 'голосов') : undefined
    });
  }

  return [
    { id: 'cards', title: 'Карточки', items: cardItems },
    { id: 'votes', title: 'Голоса', items: voteItems },
    { id: 'talk', title: 'Обсуждение', items: talkItems }
  ].filter((section) => section.items.length > 0);
};

const buildArkanoidStatSection = (
  remote: ArkanoidScoreEntry[],
  local: { userName?: string; score: number; cardsBroken: number; played: boolean }
): RetroStatSection | null => {
  const byName = new Map<string, ArkanoidScoreEntry>();
  remote.forEach((entry) => {
    const name = entry.userName?.trim();
    const score = Math.max(0, Math.floor(Number(entry.score) || 0));
    if (!name || !Number.isFinite(score)) return;
    const cardsBroken = Math.max(0, Math.floor(Number(entry.cardsBroken) || 0));
    const existing = byName.get(name);
    if (!existing || score > existing.score) {
      byName.set(name, { userName: name, score, cardsBroken });
    }
  });

  const localName = local.userName?.trim();
  if (localName && (local.score > 0 || local.played)) {
    const existing = byName.get(localName);
    const localScore = Math.max(0, Math.floor(local.score || 0));
    if (!existing || localScore > existing.score) {
      byName.set(localName, {
        userName: localName,
        score: localScore,
        cardsBroken: Math.max(0, Math.floor(local.cardsBroken || 0))
      });
    }
  }

  const entries = Array.from(byName.values()).sort((a, b) => b.score - a.score || a.userName.localeCompare(b.userName, 'ru'));
  if (entries.length === 0) return null;
  const bestScore = entries[0].score;
  return {
    id: 'arkanoid',
    title: 'Arkanoid',
    items: entries.map((entry) => ({
      id: `arkanoid-${entry.userName}`,
      label: bestScore > 0 && entry.score === bestScore ? 'Больше всех очков в Arkanoid' : 'Играл в Arkanoid',
      primary: entry.userName,
      secondary: `${countLabel(entry.score, 'очко', 'очка', 'очков')} · ${countLabel(entry.cardsBroken, 'разбитая карточка', 'разбитые карточки', 'разбитых карточек')}`
    }))
  };
};

const RetroRatingView: React.FC<Props> = observer(({ store }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const ratingOptions = useMemo(
    () => (theme.palette.mode === 'dark' ? DARK_RATING_OPTIONS : LIGHT_RATING_OPTIONS),
    [theme.palette.mode]
  );
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  useEffect(() => {
    store.ensureArkanoidStats();
  }, [store, store.room?.id, store.currentUser?.name]);
  const rating = store.retroRating;
  const isAdmin = store.currentUser?.role === 'admin';
  const canShowResults = isAdmin && rating.votesCount >= rating.totalCount && rating.totalCount > 0;
  const statSections = useMemo(() => {
    if (!rating.resultsVisible) return [];
    const sections = buildRetroStatSections({
      cards: store.cards,
      users: store.users,
      chatMessages: store.chatMessages,
      columnTitles: store.columnTitles,
      template: store.templateConfig,
      anonymous: store.roomFeatures.anonymousEnabled,
      dislikesEnabled: store.roomFeatures.dislikesEnabled,
      commentsEnabled: store.roomFeatures.commentsEnabled,
      reactionsEnabled: store.roomFeatures.reactionsEnabled,
      chatEnabled: store.roomFeatures.chatEnabled,
      sprintVipName: store.sprintVip.vipUserName,
      sprintVipVotes: store.sprintVip.voteCount
    });
    if (store.roomFeatures.arkanoidEnabled) {
      const arkanoidSection = buildArkanoidStatSection(store.arkanoidScores, {
        userName: store.currentUser?.name,
        score: store.arkanoidBestScore,
        cardsBroken: store.arkanoidBestCardsBroken,
        played: store.arkanoidHasPlayed
      });
      if (arkanoidSection) sections.push(arkanoidSection);
    }
    return sections;
  }, [
    rating.resultsVisible,
    store.cards,
    store.users,
    store.chatMessages,
    store.columnTitles,
    store.templateConfig,
    store.roomFeatures.anonymousEnabled,
    store.roomFeatures.dislikesEnabled,
    store.roomFeatures.commentsEnabled,
    store.roomFeatures.reactionsEnabled,
    store.roomFeatures.chatEnabled,
    store.roomFeatures.arkanoidEnabled,
    store.sprintVip.vipUserName,
    store.sprintVip.voteCount,
    store.arkanoidScores,
    store.arkanoidBestScore,
    store.arkanoidBestCardsBroken,
    store.arkanoidHasPlayed,
    store.currentUser?.name
  ]);
  const hasCards = store.cards.length > 0;

  const handleSubmit = () => {
    if (!selectedRating) return;
    store.socketService?.submitRetroRating(selectedRating);
  };

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={3} sx={{ width: '100%', maxWidth: 820, p: { xs: 2.5, md: 3 }, borderRadius: 1 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.15, mb: 2, fontSize: { xs: '2rem', md: '2.75rem' } }}>
          Оцените ретро
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Стоило ли это ретро нашего времени? Оцените ретро от 1 до 5. Будьте честны — это анонимно!
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          После того, как все выберут оценку, ведущий отобразит результаты.
        </Typography>

        <Box sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Stepper activeStep={rating.resultsVisible ? 1 : 0} alternativeLabel sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Step>
              <StepLabel>Оценка</StepLabel>
            </Step>
            <Step>
              <StepLabel>Просмотр результатов</StepLabel>
            </Step>
          </Stepper>

          {!rating.resultsVisible ? (
            <Box>
              {ratingOptions.map((option) => (
                <Box
                  key={option.value}
                  onClick={() => !rating.hasVoted && setSelectedRating(option.value)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.4,
                    cursor: rating.hasVoted ? 'default' : 'pointer',
                    bgcolor: option.bgcolor,
                    color: option.color,
                    opacity: rating.hasVoted && selectedRating !== option.value ? 0.75 : 1
                  }}
                >
                  <Radio
                    checked={selectedRating === option.value || (rating.hasVoted && selectedRating === option.value)}
                    disabled={rating.hasVoted}
                    onChange={() => setSelectedRating(option.value)}
                    sx={{
                      color: option.color,
                      '&.Mui-checked': { color: option.color }
                    }}
                  />
                  <Typography sx={{ fontWeight: 700 }}>
                    {option.value} — {option.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ p: 2.5 }}>
              <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 700 }}>
                Результаты оценки
              </Typography>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Средняя оценка: <b>{rating.average?.toFixed(1) ?? '—'}</b>
              </Typography>
              {ratingOptions.map((option) => {
                const count = rating.distribution?.[option.value] || 0;
                const percent = rating.votesCount > 0 ? Math.round((count / rating.votesCount) * 100) : 0;
                return (
                  <Box key={option.value} sx={{ mb: 1.25 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="body2">{option.value} — {option.label}</Typography>
                      <Typography variant="body2">{count} ({percent}%)</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={percent}
                      sx={{
                        height: 10,
                        borderRadius: 999,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                        '& .MuiLinearProgress-bar': { bgcolor: option.barColor }
                      }}
                    />
                  </Box>
                );
              })}

              <Box sx={{ mt: 3.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Статистика ретро
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Кто писал карточки, кто голосовал, кто больше всех обсуждал{store.roomFeatures.arkanoidEnabled ? ' и кто играл в Arkanoid' : ''}.
                  {store.roomFeatures.anonymousEnabled ? ' На доске авторы скрыты, в этой сводке имена видны.' : ''}
                </Typography>

                {!hasCards && statSections.length === 0 ? (
                  <Typography color="text.secondary">Пока нет карточек и активности, чтобы собрать сводку.</Typography>
                ) : (
                  statSections.map((section) => (
                    <Box key={section.id} sx={{ mb: 2.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                        {section.title}
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                          gap: 1.25
                        }}
                      >
                        {section.items.map((item) => (
                          <Box
                            key={item.id}
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, lineHeight: 1.35 }}>
                              {item.label}
                            </Typography>
                            <Typography sx={{ fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                              {item.primary}
                            </Typography>
                            {item.secondary && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                                {item.secondary}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          )}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'center',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: 2,
          }}
        >
          {!rating.resultsVisible && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={handleSubmit} disabled={!selectedRating || rating.hasVoted}>
                {rating.hasVoted ? 'Оценка принята' : 'Отправить оценку'}
              </Button>
              {isAdmin && (
                <Button variant="contained" color="info" onClick={() => store.socketService?.showRetroRatingResults()} disabled={!canShowResults}>
                  Показать результаты
                </Button>
              )}
            </Box>
          )}
          <Button
            variant="outlined"
            startIcon={<ExitToAppIcon />}
            onClick={() => store.socketService?.leaveRoom()}
            sx={{ alignSelf: isMobile ? 'center' : 'auto' }}
          >
            Выйти из комнаты
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
          {rating.votesCount} / {rating.totalCount} участников проголосовало
        </Typography>
      </Paper>
    </Box>
  );
});

export default RetroRatingView;
