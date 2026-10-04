import { ColumnColorId, RoomFeatures } from '../types';

export interface BoardCommands {
  setColumnTitles(titles: string[]): void;
  setColumnColors(colors: ColumnColorId[]): void;
  setRoomFeatures(features: RoomFeatures): void;
  setRoomBackground(backgroundImage: string): void;
  updateReadyState(isReady: boolean): void;
}

export interface BoardHost {
  persistBoardState(): void;
  commands(): BoardCommands | null;
}

export interface ExtrasHost {
  roomId(): string | undefined;
  userName(): string | undefined;
  submitArkanoidScore(score: number, cardsBroken: number): void;
}
