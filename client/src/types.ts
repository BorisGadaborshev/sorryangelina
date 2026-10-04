import {
  RETRO_TEMPLATES,
  getCardTextSegments,
  joinCardTextSegments,
  type AuthProfileType,
  type Card,
  type ColumnColorId,
  type Phase,
  type RetroTemplate,
  type RetroTemplateId
} from '@sorryangelina/shared';

export * from '@sorryangelina/shared';

export const COLUMN_COLOR_PRESETS: Record<ColumnColorId, {
  label: string;
  light: { bg: string; accent: string };
  dark: { bg: string; accent: string };
}> = {
  none: { label: 'Без цвета', light: { bg: 'transparent', accent: '#90a4ae' }, dark: { bg: 'transparent', accent: '#78909c' } },
  teal: { label: 'Бирюзовый', light: { bg: '#e0f2ef', accent: '#00897b' }, dark: { bg: '#1c2b28', accent: '#4db6ac' } },
  pink: { label: 'Розовый', light: { bg: '#fce4ec', accent: '#d81b60' }, dark: { bg: '#2c1f24', accent: '#f06292' } },
  purple: { label: 'Фиолетовый', light: { bg: '#f3e5f5', accent: '#8e24aa' }, dark: { bg: '#261d2c', accent: '#ba68c8' } },
  blue: { label: 'Синий', light: { bg: '#e3f2fd', accent: '#1565c0' }, dark: { bg: '#1c2633', accent: '#64b5f6' } },
  indigo: { label: 'Индиго', light: { bg: '#e8eaf6', accent: '#3949ab' }, dark: { bg: '#20233a', accent: '#7986cb' } },
  cyan: { label: 'Голубой', light: { bg: '#e0f7fa', accent: '#00838f' }, dark: { bg: '#1a2b2e', accent: '#4dd0e1' } },
  green: { label: 'Зелёный', light: { bg: '#e8f5e9', accent: '#2e7d32' }, dark: { bg: '#1d2a1f', accent: '#81c784' } },
  amber: { label: 'Янтарный', light: { bg: '#fff8e1', accent: '#f9a825' }, dark: { bg: '#2c2718', accent: '#ffd54f' } },
  orange: { label: 'Оранжевый', light: { bg: '#fff3e0', accent: '#ef6c00' }, dark: { bg: '#2c2318', accent: '#ffb74d' } },
  slate: { label: 'Серый', light: { bg: '#eceff1', accent: '#546e7a' }, dark: { bg: '#23282c', accent: '#90a4ae' } }
};

export const RETRO_TEMPLATE_LIST: RetroTemplate[] = [
  RETRO_TEMPLATES.classic,
  RETRO_TEMPLATES['start-stop-continue'],
  RETRO_TEMPLATES.sailboat,
  RETRO_TEMPLATES['four-ls'],
  RETRO_TEMPLATES['traffic-light']
];

export const getColumnColorStyles = (colorId: ColumnColorId, mode: 'light' | 'dark') => {
  const preset = COLUMN_COLOR_PRESETS[colorId] ?? COLUMN_COLOR_PRESETS.none;
  const colors = mode === 'dark' ? preset.dark : preset.light;
  return {
    fill: colorId === 'none' ? undefined : colors.bg,
    accent: colors.accent
  };
};

export const DISCUSSION_BURST_OPTIONS = [
  { emoji: '😂', label: 'Смех' },
  { emoji: '😭', label: 'Плач' },
  { emoji: '😠', label: 'Злость' },
  { emoji: '👍', label: 'Палец вверх' },
  { emoji: '👎', label: 'Палец вниз' },
  { emoji: '😮', label: 'Удивление' },
  { emoji: '🤮', label: 'Рвота' },
  { emoji: '👏', label: 'Аплодисменты' },
  { emoji: '❤️', label: 'Сердце' },
  { emoji: '🔥', label: 'Огонь' },
  { emoji: '🎉', label: 'Праздник' },
  { emoji: '🥰', label: 'Умиление' }
] as const;

const CARD_TEXT_EDIT_SEPARATOR = /\n-{3,}\n/;

export const cardTextToEditorValue = (text: string): string =>
  getCardTextSegments(text).join('\n---\n');

export const editorValueToCardText = (value: string): string =>
  joinCardTextSegments(value.split(CARD_TEXT_EDIT_SEPARATOR));

const flattenMarkdownLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

const withMarkdownAuthor = (text: string, author?: string): string => {
  const name = author?.trim();
  return name ? `${text} // ${name}` : text;
};

export const buildColumnMarkdown = (cards: Card[]): string =>
  cards
    .map((card) => {
      const title =
        flattenMarkdownLine(getCardTextSegments(card.text).join(' — '))
        || (card.imageUrl ? '[изображение]' : '');
      if (!title) return '';

      const lines = [`- ${withMarkdownAuthor(title, card.createdBy)}`];
      for (const comment of card.comments || []) {
        const commentText = flattenMarkdownLine(comment.text || '');
        if (!commentText) continue;
        lines.push(`  - ${withMarkdownAuthor(commentText, comment.userName)}`);
      }
      return lines.join('\n');
    })
    .filter(Boolean)
    .join('\n');

export interface CreateRoomOptions {
  teamId?: string;
  template?: RetroTemplateId;
}

export const BUILTIN_TEAM_ID = 'cards-partners';

export interface AuthProfile {
  name: string;
  type: AuthProfileType;
  token: string;
  expiresAt: number;
}

export interface AvailableRoom {
  id: string;
  teamId?: string;
  usersCount: number;
  phase: Phase;
  owner: string;
  createdAt?: string;
  hasPassword?: boolean;
}
