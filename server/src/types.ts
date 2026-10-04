import type { Card, ColumnColorId, Phase, RetroTemplateId, RoomFeatures, Team, TeamRole, User } from '@sorryangelina/shared';

export * from '@sorryangelina/shared';

// Интерфейс для комнаты в базе данных
export interface RoomDocument {
  id: string;
  password: string;
  hasPassword: boolean;
  teamId?: string;
  owner: string;
  phase: Phase;
  template?: RetroTemplateId;
  columnTitles?: string[];
  columnColors?: ColumnColorId[];
  features?: RoomFeatures;
  createdAt?: string;
  users: User[];
  cards: Card[];
}

export interface CreateRoomOptions {
  teamId?: string;
  userRole?: TeamRole;
  template?: RetroTemplateId;
}

export interface TeamDocument extends Team {
  passwordHash: string;
  passwordVersion: number;
}

export interface CreateTeamInput {
  name: string;
  password: string;
  owner: string;
  members: string[];
  scrumMasterName?: string;
}
