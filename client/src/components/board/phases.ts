import React from 'react';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import HowToVoteRoundedIcon from '@mui/icons-material/HowToVoteRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import { Phase, RetroTemplateId } from '../../types';

export const PHASE_OPTIONS: Array<{
  value: Phase;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}> = [
  { value: 'creation', label: 'Создание', shortLabel: 'Создание', icon: EditNoteRoundedIcon },
  { value: 'voting', label: 'Голосование', shortLabel: 'Голоса', icon: HowToVoteRoundedIcon },
  { value: 'discussion', label: 'Обсуждение', shortLabel: 'Обсуждение', icon: ForumRoundedIcon },
  { value: 'roadmap', label: 'Дорожная карта', shortLabel: 'Карта', icon: AccountTreeRoundedIcon },
  { value: 'rating', label: 'Оценка ретро', shortLabel: 'Оценка', icon: AutoAwesomeRoundedIcon },
];

const PHASE_LABELS: Record<Phase, string> = {
  creation: 'Создание',
  voting: 'Голосование',
  discussion: 'Обсуждение',
  roadmap: 'Дорожная карта',
  rating: 'Оценка ретро'
};

export const getPhaseLabel = (phase: Phase): string => PHASE_LABELS[phase];

export const getNextPhase = (phase: Phase, templateId: RetroTemplateId, retroRatingEnabled: boolean): Phase | null => {
  if (phase === 'creation') return 'voting';
  if (phase === 'voting') return 'discussion';
  if (phase === 'discussion') return templateId === 'traffic-light' ? 'roadmap' : (retroRatingEnabled ? 'rating' : null);
  if (phase === 'roadmap') return retroRatingEnabled ? 'rating' : null;
  return null;
};
