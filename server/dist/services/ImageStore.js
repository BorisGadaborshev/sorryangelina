"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.purgeExpiredImages = exports.wipeAllUploads = exports.migrateInlineImages = exports.reassignCardMedia = exports.deleteRoomMedia = exports.deleteRoomCardMedia = exports.deleteCardMedia = exports.replaceBackgroundImage = exports.replaceCardImage = exports.persistImageValue = exports.ensureUploadDir = exports.isAllowedImageValue = exports.isLocalUploadUrl = exports.getUploadDir = exports.IMAGE_CLEANUP_INTERVAL_MS = exports.IMAGE_TTL_MS = void 0;
const crypto_1 = require("crypto");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
exports.IMAGE_TTL_MS = 2 * 60 * 60 * 1000;
exports.IMAGE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const LOCAL_UPLOAD_PATH = /^\/(?:api\/)?uploads\/([a-zA-Z0-9._-]+)$/;
const PUBLIC_UPLOAD_PREFIX = '/api/uploads';
const MIME_TO_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
};
const getUploadDir = () => process.env.UPLOAD_DIR || path_1.default.join(process.cwd(), 'uploads');
exports.getUploadDir = getUploadDir;
const getFilePath = (fileName) => path_1.default.join((0, exports.getUploadDir)(), fileName);
const isLocalUploadUrl = (value) => LOCAL_UPLOAD_PATH.test(value);
exports.isLocalUploadUrl = isLocalUploadUrl;
const isAllowedImageValue = (value) => {
    if (/^https?:\/\//i.test(value))
        return true;
    if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value))
        return true;
    return (0, exports.isLocalUploadUrl)(value);
};
exports.isAllowedImageValue = isAllowedImageValue;
const safeFileName = (value) => {
    const match = LOCAL_UPLOAD_PATH.exec(value);
    return (match === null || match === void 0 ? void 0 : match[1]) || null;
};
const ensureUploadDir = () => __awaiter(void 0, void 0, void 0, function* () {
    yield promises_1.default.mkdir((0, exports.getUploadDir)(), { recursive: true });
});
exports.ensureUploadDir = ensureUploadDir;
const sniffImageExt = (buffer) => {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
        return 'jpg';
    if (buffer.length >= 8
        && buffer[0] === 0x89
        && buffer[1] === 0x50
        && buffer[2] === 0x4e
        && buffer[3] === 0x47)
        return 'png';
    if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46)
        return 'gif';
    if (buffer.length >= 12
        && buffer[0] === 0x52
        && buffer[1] === 0x49
        && buffer[2] === 0x46
        && buffer[3] === 0x46
        && buffer[8] === 0x57
        && buffer[9] === 0x45
        && buffer[10] === 0x42
        && buffer[11] === 0x50)
        return 'webp';
    return undefined;
};
const deleteFileIfExists = (fileName) => __awaiter(void 0, void 0, void 0, function* () {
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\'))
        return;
    try {
        yield promises_1.default.unlink(getFilePath(fileName));
    }
    catch (error) {
        const code = error.code;
        if (code !== 'ENOENT') {
            console.error('Failed to delete image file:', fileName, error);
        }
    }
});
const saveDataUrl = (dataUrl) => __awaiter(void 0, void 0, void 0, function* () {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
    if (!match)
        return undefined;
    const mime = match[1].toLowerCase();
    const mimeExt = MIME_TO_EXT[mime];
    let buffer;
    try {
        buffer = Buffer.from(match[2], 'base64');
    }
    catch (_a) {
        return undefined;
    }
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES)
        return undefined;
    const sniffedExt = sniffImageExt(buffer) || mimeExt;
    if (!sniffedExt)
        return undefined;
    yield (0, exports.ensureUploadDir)();
    const fileName = `${(0, crypto_1.randomUUID)()}.${sniffedExt}`;
    yield promises_1.default.writeFile(getFilePath(fileName), buffer);
    return { publicUrl: `${PUBLIC_UPLOAD_PREFIX}/${fileName}`, fileName };
});
const persistImageValue = (value) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    if (trimmed.startsWith('data:image/')) {
        const saved = yield saveDataUrl(trimmed);
        return saved === null || saved === void 0 ? void 0 : saved.publicUrl;
    }
    if ((0, exports.isLocalUploadUrl)(trimmed)) {
        const fileName = safeFileName(trimmed);
        if (!fileName)
            return undefined;
        try {
            yield promises_1.default.access(getFilePath(fileName));
            return `${PUBLIC_UPLOAD_PREFIX}/${fileName}`;
        }
        catch (_b) {
            return undefined;
        }
    }
    if (/^https?:\/\//i.test(trimmed) && trimmed.length <= MAX_IMAGE_BYTES) {
        return trimmed;
    }
    return undefined;
});
exports.persistImageValue = persistImageValue;
const insertMedia = (roomId, kind, publicUrl, fileName, cardId) => __awaiter(void 0, void 0, void 0, function* () {
    yield database_1.pool.query(`insert into room_media (id, room_id, kind, card_id, public_url, file_name, created_at)
     values ($1,$2,$3,$4,$5,$6, now())`, [(0, crypto_1.randomUUID)(), roomId, kind, cardId !== null && cardId !== void 0 ? cardId : null, publicUrl, fileName]);
});
const fileNameFromUrl = (publicUrl) => safeFileName(publicUrl);
const deleteMediaRows = (rows) => __awaiter(void 0, void 0, void 0, function* () {
    for (const row of rows) {
        yield deleteFileIfExists(row.file_name);
    }
    if (rows.length === 0)
        return;
    yield database_1.pool.query('delete from room_media where id = any($1::text[])', [rows.map((row) => row.id)]);
});
const replaceCardImage = (roomId, cardId, imageValue) => __awaiter(void 0, void 0, void 0, function* () {
    const nextUrl = yield (0, exports.persistImageValue)(imageValue);
    const existing = yield database_1.pool.query('select id, room_id, kind, card_id, public_url, file_name, created_at from room_media where room_id=$1 and card_id=$2', [roomId, cardId]);
    yield deleteMediaRows(existing.rows);
    if (!nextUrl)
        return undefined;
    yield insertMedia(roomId, 'card', nextUrl, fileNameFromUrl(nextUrl), cardId);
    return nextUrl;
});
exports.replaceCardImage = replaceCardImage;
const replaceBackgroundImage = (roomId, imageValue) => __awaiter(void 0, void 0, void 0, function* () {
    const nextUrl = (yield (0, exports.persistImageValue)(imageValue)) || '';
    const existing = yield database_1.pool.query(`select id, room_id, kind, card_id, public_url, file_name, created_at
     from room_media where room_id=$1 and kind='background'`, [roomId]);
    yield deleteMediaRows(existing.rows);
    if (nextUrl) {
        yield insertMedia(roomId, 'background', nextUrl, fileNameFromUrl(nextUrl));
    }
    return nextUrl;
});
exports.replaceBackgroundImage = replaceBackgroundImage;
const deleteCardMedia = (roomId, cardId) => __awaiter(void 0, void 0, void 0, function* () {
    const existing = yield database_1.pool.query('select id, room_id, kind, card_id, public_url, file_name, created_at from room_media where room_id=$1 and card_id=$2', [roomId, cardId]);
    yield deleteMediaRows(existing.rows);
});
exports.deleteCardMedia = deleteCardMedia;
const deleteRoomCardMedia = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const existing = yield database_1.pool.query(`select id, room_id, kind, card_id, public_url, file_name, created_at
     from room_media where room_id=$1 and kind='card'`, [roomId]);
    yield deleteMediaRows(existing.rows);
});
exports.deleteRoomCardMedia = deleteRoomCardMedia;
const deleteRoomMedia = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const existing = yield database_1.pool.query('select id, room_id, kind, card_id, public_url, file_name, created_at from room_media where room_id=$1', [roomId]);
    yield deleteMediaRows(existing.rows);
});
exports.deleteRoomMedia = deleteRoomMedia;
const reassignCardMedia = (roomId, fromCardId, toCardId) => __awaiter(void 0, void 0, void 0, function* () {
    yield database_1.pool.query('update room_media set card_id=$1 where room_id=$2 and card_id=$3', [toCardId, roomId, fromCardId]);
});
exports.reassignCardMedia = reassignCardMedia;
const deleteOrphanFiles = () => __awaiter(void 0, void 0, void 0, function* () {
    let entries = [];
    try {
        entries = yield promises_1.default.readdir((0, exports.getUploadDir)());
    }
    catch (error) {
        const code = error.code;
        if (code === 'ENOENT')
            return;
        throw error;
    }
    const cutoff = Date.now() - exports.IMAGE_TTL_MS;
    for (const fileName of entries) {
        if (fileName.startsWith('.'))
            continue;
        const filePath = getFilePath(fileName);
        try {
            const stat = yield promises_1.default.stat(filePath);
            if (stat.mtimeMs > cutoff)
                continue;
            const { rows } = yield database_1.pool.query('select 1 from room_media where file_name=$1 limit 1', [fileName]);
            if (rows.length === 0) {
                yield deleteFileIfExists(fileName);
            }
        }
        catch (error) {
            console.error('Failed to inspect upload file:', fileName, error);
        }
    }
});
const migrateInlineImages = () => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const cards = yield database_1.pool.query(`select id, room_id, image_url from cards where image_url like 'data:image%'`);
    for (const row of cards.rows) {
        const nextUrl = yield (0, exports.replaceCardImage)(row.room_id, row.id, row.image_url);
        yield database_1.pool.query('update cards set image_url=$1 where id=$2', [nextUrl || null, row.id]);
    }
    const rooms = yield database_1.pool.query(`select id, features from rooms where coalesce(features->>'backgroundImage', '') like 'data:image%'`);
    for (const row of rooms.rows) {
        const nextUrl = yield (0, exports.replaceBackgroundImage)(row.id, (_c = row.features) === null || _c === void 0 ? void 0 : _c.backgroundImage);
        yield database_1.pool.query(`update rooms
       set features = jsonb_set(coalesce(features, '{}'::jsonb), '{backgroundImage}', to_jsonb($1::text), true),
           updated_at = now()
       where id=$2`, [nextUrl, row.id]);
    }
});
exports.migrateInlineImages = migrateInlineImages;
const wipeAllUploads = () => __awaiter(void 0, void 0, void 0, function* () {
    let entries = [];
    try {
        entries = yield promises_1.default.readdir((0, exports.getUploadDir)());
    }
    catch (error) {
        const code = error.code;
        if (code === 'ENOENT')
            return;
        throw error;
    }
    yield Promise.all(entries.filter((name) => !name.startsWith('.')).map((fileName) => deleteFileIfExists(fileName)));
});
exports.wipeAllUploads = wipeAllUploads;
const purgeExpiredImages = () => __awaiter(void 0, void 0, void 0, function* () {
    const { rows } = yield database_1.pool.query(`select id, room_id, kind, card_id, public_url, file_name, created_at
     from room_media
     where created_at < now() - interval '2 hours'`);
    const expired = rows;
    const byRoom = new Map();
    const touch = (roomId) => {
        const current = byRoom.get(roomId) || { roomId, backgroundCleared: false, clearedCardIds: [] };
        byRoom.set(roomId, current);
        return current;
    };
    for (const row of expired) {
        yield deleteFileIfExists(row.file_name);
        const change = touch(row.room_id);
        if (row.kind === 'background') {
            yield database_1.pool.query(`update rooms
         set features = jsonb_set(coalesce(features, '{}'::jsonb), '{backgroundImage}', '""', true),
             updated_at = now()
         where id=$1`, [row.room_id]);
            change.backgroundCleared = true;
        }
        else if (row.card_id) {
            yield database_1.pool.query(`update cards
         set image_url = null
         where id=$1 and room_id=$2 and image_url=$3`, [row.card_id, row.room_id, row.public_url]);
            change.clearedCardIds.push(row.card_id);
        }
    }
    if (expired.length > 0) {
        yield database_1.pool.query('delete from room_media where id = any($1::text[])', [expired.map((row) => row.id)]);
    }
    yield deleteOrphanFiles();
    return Array.from(byRoom.values());
});
exports.purgeExpiredImages = purgeExpiredImages;
