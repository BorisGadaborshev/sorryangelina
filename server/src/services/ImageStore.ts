import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { pool } from '../config/database';

export const IMAGE_TTL_MS = 2 * 60 * 60 * 1000;
export const IMAGE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const LOCAL_UPLOAD_PATH = /^\/(?:api\/)?uploads\/([a-zA-Z0-9._-]+)$/;
const PUBLIC_UPLOAD_PREFIX = '/api/uploads';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

type MediaKind = 'card' | 'background';

interface MediaRow {
  id: string;
  room_id: string;
  kind: MediaKind;
  card_id: string | null;
  public_url: string;
  file_name: string | null;
  created_at: string;
}

export const getUploadDir = (): string =>
  process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

const getFilePath = (fileName: string): string => path.join(getUploadDir(), fileName);

export const isLocalUploadUrl = (value: string): boolean => LOCAL_UPLOAD_PATH.test(value);

export const isAllowedImageValue = (value: string): boolean => {
  if (/^https?:\/\//i.test(value)) return true;
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value)) return true;
  return isLocalUploadUrl(value);
};

const safeFileName = (value: string): string | null => {
  const match = LOCAL_UPLOAD_PATH.exec(value);
  return match?.[1] || null;
};

export const ensureUploadDir = async (): Promise<void> => {
  await fs.mkdir(getUploadDir(), { recursive: true });
};

const sniffImageExt = (buffer: Buffer): string | undefined => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
  ) return 'png';
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'gif';
  if (
    buffer.length >= 12
    && buffer[0] === 0x52
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x46
    && buffer[8] === 0x57
    && buffer[9] === 0x45
    && buffer[10] === 0x42
    && buffer[11] === 0x50
  ) return 'webp';
  return undefined;
};

const deleteFileIfExists = async (fileName: string | null): Promise<void> => {
  if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) return;
  try {
    await fs.unlink(getFilePath(fileName));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error('Failed to delete image file:', fileName, error);
    }
  }
};

const saveDataUrl = async (dataUrl: string): Promise<{ publicUrl: string; fileName: string } | undefined> => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
  if (!match) return undefined;
  const mime = match[1].toLowerCase();
  const mimeExt = MIME_TO_EXT[mime];

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return undefined;
  }
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return undefined;

  const sniffedExt = sniffImageExt(buffer) || mimeExt;
  if (!sniffedExt) return undefined;

  await ensureUploadDir();
  const fileName = `${randomUUID()}.${sniffedExt}`;
  await fs.writeFile(getFilePath(fileName), buffer);
  return { publicUrl: `${PUBLIC_UPLOAD_PREFIX}/${fileName}`, fileName };
};

export const persistImageValue = async (value: unknown): Promise<string | undefined> => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('data:image/')) {
    const saved = await saveDataUrl(trimmed);
    return saved?.publicUrl;
  }

  if (isLocalUploadUrl(trimmed)) {
    const fileName = safeFileName(trimmed);
    if (!fileName) return undefined;
    try {
      await fs.access(getFilePath(fileName));
      return `${PUBLIC_UPLOAD_PREFIX}/${fileName}`;
    } catch {
      return undefined;
    }
  }

  if (/^https?:\/\//i.test(trimmed) && trimmed.length <= MAX_IMAGE_BYTES) {
    return trimmed;
  }

  return undefined;
};

const insertMedia = async (
  roomId: string,
  kind: MediaKind,
  publicUrl: string,
  fileName: string | null,
  cardId?: string
): Promise<void> => {
  await pool.query(
    `insert into room_media (id, room_id, kind, card_id, public_url, file_name, created_at)
     values ($1,$2,$3,$4,$5,$6, now())`,
    [randomUUID(), roomId, kind, cardId ?? null, publicUrl, fileName]
  );
};

const fileNameFromUrl = (publicUrl: string): string | null => safeFileName(publicUrl);

const deleteMediaRows = async (rows: MediaRow[]): Promise<void> => {
  for (const row of rows) {
    await deleteFileIfExists(row.file_name);
  }
  if (rows.length === 0) return;
  await pool.query('delete from room_media where id = any($1::text[])', [rows.map((row) => row.id)]);
};

export const replaceCardImage = async (roomId: string, cardId: string, imageValue: unknown): Promise<string | undefined> => {
  const nextUrl = await persistImageValue(imageValue);
  const existing = await pool.query(
    'select id, room_id, kind, card_id, public_url, file_name, created_at from room_media where room_id=$1 and card_id=$2',
    [roomId, cardId]
  );
  await deleteMediaRows(existing.rows as MediaRow[]);
  if (!nextUrl) return undefined;
  await insertMedia(roomId, 'card', nextUrl, fileNameFromUrl(nextUrl), cardId);
  return nextUrl;
};

export const replaceBackgroundImage = async (roomId: string, imageValue: unknown): Promise<string> => {
  const nextUrl = (await persistImageValue(imageValue)) || '';
  const existing = await pool.query(
    `select id, room_id, kind, card_id, public_url, file_name, created_at
     from room_media where room_id=$1 and kind='background'`,
    [roomId]
  );
  await deleteMediaRows(existing.rows as MediaRow[]);
  if (nextUrl) {
    await insertMedia(roomId, 'background', nextUrl, fileNameFromUrl(nextUrl));
  }
  return nextUrl;
};

export const deleteCardMedia = async (roomId: string, cardId: string): Promise<void> => {
  const existing = await pool.query(
    'select id, room_id, kind, card_id, public_url, file_name, created_at from room_media where room_id=$1 and card_id=$2',
    [roomId, cardId]
  );
  await deleteMediaRows(existing.rows as MediaRow[]);
};

export const deleteRoomCardMedia = async (roomId: string): Promise<void> => {
  const existing = await pool.query(
    `select id, room_id, kind, card_id, public_url, file_name, created_at
     from room_media where room_id=$1 and kind='card'`,
    [roomId]
  );
  await deleteMediaRows(existing.rows as MediaRow[]);
};

export const deleteRoomMedia = async (roomId: string): Promise<void> => {
  const existing = await pool.query(
    'select id, room_id, kind, card_id, public_url, file_name, created_at from room_media where room_id=$1',
    [roomId]
  );
  await deleteMediaRows(existing.rows as MediaRow[]);
};

export const reassignCardMedia = async (roomId: string, fromCardId: string, toCardId: string): Promise<void> => {
  await pool.query(
    'update room_media set card_id=$1 where room_id=$2 and card_id=$3',
    [toCardId, roomId, fromCardId]
  );
};

const deleteOrphanFiles = async (): Promise<void> => {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(getUploadDir());
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return;
    throw error;
  }

  const cutoff = Date.now() - IMAGE_TTL_MS;
  for (const fileName of entries) {
    if (fileName.startsWith('.')) continue;
    const filePath = getFilePath(fileName);
    try {
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs > cutoff) continue;
      const { rows } = await pool.query('select 1 from room_media where file_name=$1 limit 1', [fileName]);
      if (rows.length === 0) {
        await deleteFileIfExists(fileName);
      }
    } catch (error) {
      console.error('Failed to inspect upload file:', fileName, error);
    }
  }
};

export interface ExpiredImageChange {
  roomId: string;
  backgroundCleared: boolean;
  clearedCardIds: string[];
}

export const migrateInlineImages = async (): Promise<void> => {
  const cards = await pool.query(
    `select id, room_id, image_url from cards where image_url like 'data:image%'`
  );
  for (const row of cards.rows as Array<{ id: string; room_id: string; image_url: string }>) {
    const nextUrl = await replaceCardImage(row.room_id, row.id, row.image_url);
    await pool.query('update cards set image_url=$1 where id=$2', [nextUrl || null, row.id]);
  }

  const rooms = await pool.query(
    `select id, features from rooms where coalesce(features->>'backgroundImage', '') like 'data:image%'`
  );
  for (const row of rooms.rows as Array<{ id: string; features: { backgroundImage?: string } | null }>) {
    const nextUrl = await replaceBackgroundImage(row.id, row.features?.backgroundImage);
    await pool.query(
      `update rooms
       set features = jsonb_set(coalesce(features, '{}'::jsonb), '{backgroundImage}', to_jsonb($1::text), true),
           updated_at = now()
       where id=$2`,
      [nextUrl, row.id]
    );
  }
};

export const wipeAllUploads = async (): Promise<void> => {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(getUploadDir());
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return;
    throw error;
  }
  await Promise.all(entries.filter((name) => !name.startsWith('.')).map((fileName) => deleteFileIfExists(fileName)));
};

export const purgeExpiredImages = async (): Promise<ExpiredImageChange[]> => {
  const { rows } = await pool.query(
    `select id, room_id, kind, card_id, public_url, file_name, created_at
     from room_media
     where created_at < now() - interval '2 hours'`
  );
  const expired = rows as MediaRow[];
  const byRoom = new Map<string, ExpiredImageChange>();

  const touch = (roomId: string): ExpiredImageChange => {
    const current = byRoom.get(roomId) || { roomId, backgroundCleared: false, clearedCardIds: [] };
    byRoom.set(roomId, current);
    return current;
  };

  for (const row of expired) {
    await deleteFileIfExists(row.file_name);
    const change = touch(row.room_id);
    if (row.kind === 'background') {
      await pool.query(
        `update rooms
         set features = jsonb_set(coalesce(features, '{}'::jsonb), '{backgroundImage}', '""', true),
             updated_at = now()
         where id=$1`,
        [row.room_id]
      );
      change.backgroundCleared = true;
    } else if (row.card_id) {
      await pool.query(
        `update cards
         set image_url = null
         where id=$1 and room_id=$2 and image_url=$3`,
        [row.card_id, row.room_id, row.public_url]
      );
      change.clearedCardIds.push(row.card_id);
    }
  }

  if (expired.length > 0) {
    await pool.query('delete from room_media where id = any($1::text[])', [expired.map((row) => row.id)]);
  }

  await deleteOrphanFiles();
  return Array.from(byRoom.values());
};
