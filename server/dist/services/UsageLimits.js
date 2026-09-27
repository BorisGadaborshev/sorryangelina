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
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockAndAssertCardSlot = exports.assertCardSlotAvailable = exports.reserveCreationSlot = exports.assertCreationSlotAvailable = exports.CARD_LIMIT_MESSAGE = exports.DAILY_ROOM_LIMIT_MESSAGE = exports.DAILY_TEAM_LIMIT_MESSAGE = exports.CARDS_PER_PERSON_PER_ROOM = exports.DAILY_ROOM_LIMIT = exports.DAILY_TEAM_LIMIT = exports.UsageLimitError = void 0;
const database_1 = require("../config/database");
class UsageLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UsageLimitError';
    }
}
exports.UsageLimitError = UsageLimitError;
exports.DAILY_TEAM_LIMIT = 5;
exports.DAILY_ROOM_LIMIT = 5;
exports.CARDS_PER_PERSON_PER_ROOM = 100;
exports.DAILY_TEAM_LIMIT_MESSAGE = 'Можно создать не больше 5 команд в день';
exports.DAILY_ROOM_LIMIT_MESSAGE = 'Можно создать не больше 5 комнат в день';
exports.CARD_LIMIT_MESSAGE = 'В одной комнате можно добавить не больше 100 карточек';
const DAY_TIMEZONE = 'Europe/Moscow';
const limitFor = (kind) => (kind === 'team' ? exports.DAILY_TEAM_LIMIT : exports.DAILY_ROOM_LIMIT);
const messageFor = (kind) => (kind === 'team' ? exports.DAILY_TEAM_LIMIT_MESSAGE : exports.DAILY_ROOM_LIMIT_MESSAGE);
const countCreationsToday = (queryable, actorName, kind) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { rows } = yield queryable.query(`select count(*)::int as count
     from creation_events
     where actor_name = $1
       and kind = $2
       and created_at >= (date_trunc('day', now() at time zone $3) at time zone $3)`, [actorName, kind, DAY_TIMEZONE]);
    return Number((_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0);
});
const assertCreationSlotAvailable = (actorName, kind) => __awaiter(void 0, void 0, void 0, function* () {
    const count = yield countCreationsToday(database_1.pool, actorName, kind);
    if (count >= limitFor(kind)) {
        throw new UsageLimitError(messageFor(kind));
    }
});
exports.assertCreationSlotAvailable = assertCreationSlotAvailable;
const reserveCreationSlot = (client, actorName, kind, subjectId) => __awaiter(void 0, void 0, void 0, function* () {
    yield client.query('select pg_advisory_xact_lock(hashtext($1)::bigint)', [`${kind}:${actorName}`]);
    const count = yield countCreationsToday(client, actorName, kind);
    if (count >= limitFor(kind)) {
        throw new UsageLimitError(messageFor(kind));
    }
    yield client.query(`insert into creation_events (actor_name, kind, subject_id)
     values ($1, $2, $3)
     on conflict (kind, subject_id) do nothing`, [actorName, kind, subjectId]);
});
exports.reserveCreationSlot = reserveCreationSlot;
const assertCardSlotAvailable = (roomId, createdBy) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    const { rows } = yield database_1.pool.query('select count(*)::int as count from cards where room_id = $1 and created_by = $2', [roomId, createdBy]);
    const count = Number((_d = (_c = rows[0]) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0);
    if (count >= exports.CARDS_PER_PERSON_PER_ROOM) {
        throw new UsageLimitError(exports.CARD_LIMIT_MESSAGE);
    }
});
exports.assertCardSlotAvailable = assertCardSlotAvailable;
const lockAndAssertCardSlot = (client, roomId, createdBy) => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f;
    yield client.query('select pg_advisory_xact_lock(hashtext($1)::bigint)', [`card:${roomId}:${createdBy}`]);
    const { rows } = yield client.query('select count(*)::int as count from cards where room_id = $1 and created_by = $2', [roomId, createdBy]);
    const count = Number((_f = (_e = rows[0]) === null || _e === void 0 ? void 0 : _e.count) !== null && _f !== void 0 ? _f : 0);
    if (count >= exports.CARDS_PER_PERSON_PER_ROOM) {
        throw new UsageLimitError(exports.CARD_LIMIT_MESSAGE);
    }
});
exports.lockAndAssertCardSlot = lockAndAssertCardSlot;
