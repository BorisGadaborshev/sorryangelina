import {
  ColumnColorId,
  DEFAULT_TEAM_ROOM_SETTINGS,
  getRetroTemplate,
  isRetroTemplateId,
  normalizeColumnColors,
  RetroTemplate,
  RetroTemplateId,
  RoomFeatures,
  TeamRoomSettings
} from '../types';
import { normalizeRoomFeatures } from './roomFeatures';

const templateColumns = (template: RetroTemplate) => ({
  columnTitles: template.columns.map((column) => column.title),
  columnColors: template.columns.map((column) => column.color)
});

export const normalizeTeamRoomSettings = (raw: unknown): TeamRoomSettings => {
  const source = raw && typeof raw === 'object' ? raw as Partial<TeamRoomSettings> : {};
  const template = getRetroTemplate(typeof source.template === 'string' ? source.template : undefined);
  const defaults = templateColumns(template);
  const titles = Array.isArray(source.columnTitles)
    && source.columnTitles.length === defaults.columnTitles.length
    && source.columnTitles.every((title) => typeof title === 'string' && title.trim())
    ? source.columnTitles.map((title) => title.trim())
    : defaults.columnTitles;

  return {
    template: template.id,
    columnTitles: titles,
    columnColors: normalizeColumnColors(source.columnColors, template),
    features: { ...normalizeRoomFeatures(source.features), backgroundImage: '' }
  };
};

export const roomSettingsForNewRoom = (
  stored: TeamRoomSettings,
  templateId?: string
): { settings: TeamRoomSettings; templateChanged: boolean } => {
  if (!templateId || !isRetroTemplateId(templateId) || templateId === stored.template) {
    return { settings: stored, templateChanged: false };
  }

  const template = getRetroTemplate(templateId);
  const defaults = templateColumns(template);
  return {
    templateChanged: true,
    settings: {
      ...stored,
      template: template.id,
      columnTitles: defaults.columnTitles,
      columnColors: defaults.columnColors
    }
  };
};

export const changedRoomFeatures = (before: RoomFeatures, after: RoomFeatures): Partial<RoomFeatures> => {
  const patch: Partial<RoomFeatures> = {};
  (Object.keys(DEFAULT_TEAM_ROOM_SETTINGS.features) as (keyof RoomFeatures)[]).forEach((key) => {
    if (key === 'backgroundImage' || before[key] === after[key]) return;
    patch[key] = after[key] as never;
  });
  return patch;
};

export const patchTeamRoomFeatures = (
  settings: TeamRoomSettings,
  patch: Partial<RoomFeatures>
): TeamRoomSettings => {
  const rest = { ...patch };
  delete rest.backgroundImage;
  if (Object.keys(rest).length === 0) return settings;
  return {
    ...settings,
    features: { ...normalizeRoomFeatures({ ...settings.features, ...rest }), backgroundImage: '' }
  };
};

export const withColumnTitles = (
  settings: TeamRoomSettings,
  templateId: RetroTemplateId,
  titles: string[]
): TeamRoomSettings | null => {
  if (settings.template !== templateId) return null;
  const expected = getRetroTemplate(templateId).columns.length;
  if (titles.length !== expected || titles.some((title) => !title.trim())) return null;
  const columnTitles = titles.map((title) => title.trim());
  if (columnTitles.every((title, index) => title === settings.columnTitles[index])) return settings;
  return { ...settings, columnTitles };
};

export const withColumnColors = (
  settings: TeamRoomSettings,
  templateId: RetroTemplateId,
  colors: ColumnColorId[]
): TeamRoomSettings | null => {
  if (settings.template !== templateId) return null;
  const template = getRetroTemplate(templateId);
  const columnColors = normalizeColumnColors(colors, template);
  if (columnColors.length !== colors.length || columnColors.some((color, index) => color !== colors[index])) {
    return null;
  }
  if (columnColors.every((color, index) => color === settings.columnColors[index])) return settings;
  return { ...settings, columnColors };
};
