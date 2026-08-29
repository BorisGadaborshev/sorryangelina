import React from 'react';
import { DislikeIconId, LikeIconId } from '../types';

interface IconProps {
  size: number;
}

const EmojiIcon: React.FC<IconProps & { emoji: string; label: string }> = ({ size, emoji, label }) => (
  <span
    role="img"
    aria-label={label}
    style={{
      display: 'block',
      flexShrink: 0,
      width: size,
      height: size,
      lineHeight: `${size}px`,
      fontSize: size,
      textAlign: 'center'
    }}
  >
    {emoji}
  </span>
);

const PeachIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🍑" label="Персик" />
);

const BananaIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🍌" label="Банан" />
);

const HotPepperIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🌶️" label="Острый перец" />
);

const AvocadoIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🥑" label="Авокадо" />
);

const PineappleIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🍍" label="Ананас" />
);

const ThumbsUpIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="👍" label="Палец вверх" />
);

const EggplantIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🍆" label="Баклажан" />
);

const RottenTomatoIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🍅" label="Тухлый помидор" />
);

const GrapefruitIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🍊" label="Грейпфрут" />
);

const EggIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="🥚" label="Яйцо" />
);

const ThumbsDownIcon: React.FC<IconProps> = ({ size }) => (
  <EmojiIcon size={size} emoji="👎" label="Палец вниз" />
);

const LIKE_ICONS: Record<LikeIconId, React.FC<IconProps>> = {
  peach: PeachIcon,
  banana: BananaIcon,
  hotPepper: HotPepperIcon,
  avocado: AvocadoIcon,
  pineapple: PineappleIcon,
  thumbsUp: ThumbsUpIcon
};

const DISLIKE_ICONS: Record<DislikeIconId, React.FC<IconProps>> = {
  eggplant: EggplantIcon,
  rottenTomato: RottenTomatoIcon,
  grapefruit: GrapefruitIcon,
  egg: EggIcon,
  thumbsDown: ThumbsDownIcon
};

export const LIKE_ICON_OPTIONS: { id: LikeIconId; label: string }[] = [
  { id: 'peach', label: 'Персик' },
  { id: 'banana', label: 'Банан' },
  { id: 'hotPepper', label: 'Острый перец' },
  { id: 'avocado', label: 'Авокадо' },
  { id: 'pineapple', label: 'Ананас' },
  { id: 'thumbsUp', label: 'Палец вверх' }
];

export const DISLIKE_ICON_OPTIONS: { id: DislikeIconId; label: string }[] = [
  { id: 'eggplant', label: 'Баклажан' },
  { id: 'rottenTomato', label: 'Тухлый помидор' },
  { id: 'grapefruit', label: 'Грейпфрут' },
  { id: 'egg', label: 'Яйцо' },
  { id: 'thumbsDown', label: 'Палец вниз' }
];

export const getLikeIconLabel = (id: LikeIconId): string =>
  LIKE_ICON_OPTIONS.find((option) => option.id === id)?.label || 'Персик';

export const getDislikeIconLabel = (id: DislikeIconId): string =>
  DISLIKE_ICON_OPTIONS.find((option) => option.id === id)?.label || 'Баклажан';

interface VoteIconProps {
  type: 'like' | 'dislike';
  id: LikeIconId | DislikeIconId;
  size?: number;
}

export const VoteIcon: React.FC<VoteIconProps> = ({ type, id, size = 22 }) => {
  const Icon = type === 'like'
    ? LIKE_ICONS[id as LikeIconId] || PeachIcon
    : DISLIKE_ICONS[id as DislikeIconId] || EggplantIcon;
  return <Icon size={size} />;
};
