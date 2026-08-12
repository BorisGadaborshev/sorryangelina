"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRoomFeatures = exports.DEFAULT_ROOM_FEATURES = void 0;
exports.DEFAULT_ROOM_FEATURES = {
    mediaEnabled: true,
    reactionsEnabled: true,
    commentsEnabled: true,
    moveCardsEnabled: true,
    anonymousEnabled: true,
    hideCardTextDuringCreation: true,
    likesPerUser: 3,
    dislikesPerUser: 3,
    dislikesEnabled: true,
    musicEnabled: true,
    retroRatingEnabled: true,
    sprintVipEnabled: true,
    drawingEnabled: true,
    cardEditingEnabled: true,
    chatEnabled: true,
    readyEnabled: true
};
const isVoteLimit = (value) => value === 1 || value === 3 || value === 5;
const resolveVoteLimit = (value, legacyVotesPerUser, fallback) => {
    if (isVoteLimit(value))
        return value;
    if (isVoteLimit(legacyVotesPerUser))
        return legacyVotesPerUser;
    return fallback;
};
const resolveAnonymousEnabled = (raw) => {
    if (typeof (raw === null || raw === void 0 ? void 0 : raw.anonymousEnabled) === 'boolean') {
        return raw.anonymousEnabled;
    }
    if (typeof (raw === null || raw === void 0 ? void 0 : raw.cardAuthorEnabled) === 'boolean') {
        return !raw.cardAuthorEnabled;
    }
    return exports.DEFAULT_ROOM_FEATURES.anonymousEnabled;
};
const normalizeRoomFeatures = (raw) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const legacyVotesPerUser = raw === null || raw === void 0 ? void 0 : raw.votesPerUser;
    return {
        mediaEnabled: (_a = raw === null || raw === void 0 ? void 0 : raw.mediaEnabled) !== null && _a !== void 0 ? _a : exports.DEFAULT_ROOM_FEATURES.mediaEnabled,
        reactionsEnabled: (_b = raw === null || raw === void 0 ? void 0 : raw.reactionsEnabled) !== null && _b !== void 0 ? _b : exports.DEFAULT_ROOM_FEATURES.reactionsEnabled,
        commentsEnabled: (_c = raw === null || raw === void 0 ? void 0 : raw.commentsEnabled) !== null && _c !== void 0 ? _c : exports.DEFAULT_ROOM_FEATURES.commentsEnabled,
        moveCardsEnabled: (_d = raw === null || raw === void 0 ? void 0 : raw.moveCardsEnabled) !== null && _d !== void 0 ? _d : exports.DEFAULT_ROOM_FEATURES.moveCardsEnabled,
        anonymousEnabled: resolveAnonymousEnabled(raw),
        hideCardTextDuringCreation: (_e = raw === null || raw === void 0 ? void 0 : raw.hideCardTextDuringCreation) !== null && _e !== void 0 ? _e : exports.DEFAULT_ROOM_FEATURES.hideCardTextDuringCreation,
        likesPerUser: resolveVoteLimit(raw === null || raw === void 0 ? void 0 : raw.likesPerUser, legacyVotesPerUser, exports.DEFAULT_ROOM_FEATURES.likesPerUser),
        dislikesPerUser: resolveVoteLimit(raw === null || raw === void 0 ? void 0 : raw.dislikesPerUser, legacyVotesPerUser, exports.DEFAULT_ROOM_FEATURES.dislikesPerUser),
        dislikesEnabled: (_f = raw === null || raw === void 0 ? void 0 : raw.dislikesEnabled) !== null && _f !== void 0 ? _f : exports.DEFAULT_ROOM_FEATURES.dislikesEnabled,
        musicEnabled: (_g = raw === null || raw === void 0 ? void 0 : raw.musicEnabled) !== null && _g !== void 0 ? _g : exports.DEFAULT_ROOM_FEATURES.musicEnabled,
        retroRatingEnabled: (_h = raw === null || raw === void 0 ? void 0 : raw.retroRatingEnabled) !== null && _h !== void 0 ? _h : exports.DEFAULT_ROOM_FEATURES.retroRatingEnabled,
        sprintVipEnabled: (_j = raw === null || raw === void 0 ? void 0 : raw.sprintVipEnabled) !== null && _j !== void 0 ? _j : exports.DEFAULT_ROOM_FEATURES.sprintVipEnabled,
        drawingEnabled: (_k = raw === null || raw === void 0 ? void 0 : raw.drawingEnabled) !== null && _k !== void 0 ? _k : exports.DEFAULT_ROOM_FEATURES.drawingEnabled,
        cardEditingEnabled: (_l = raw === null || raw === void 0 ? void 0 : raw.cardEditingEnabled) !== null && _l !== void 0 ? _l : exports.DEFAULT_ROOM_FEATURES.cardEditingEnabled,
        chatEnabled: (_m = raw === null || raw === void 0 ? void 0 : raw.chatEnabled) !== null && _m !== void 0 ? _m : exports.DEFAULT_ROOM_FEATURES.chatEnabled,
        readyEnabled: (_o = raw === null || raw === void 0 ? void 0 : raw.readyEnabled) !== null && _o !== void 0 ? _o : exports.DEFAULT_ROOM_FEATURES.readyEnabled
    };
};
exports.normalizeRoomFeatures = normalizeRoomFeatures;
