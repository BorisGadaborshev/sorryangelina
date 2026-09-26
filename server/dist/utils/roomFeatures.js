"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRoomFeatures = exports.normalizeBackgroundImage = exports.DEFAULT_ROOM_FEATURES = void 0;
const types_1 = require("../types");
exports.DEFAULT_ROOM_FEATURES = {
    mediaEnabled: true,
    reactionsEnabled: true,
    commentsEnabled: true,
    moveCardsEnabled: false,
    membersCanAddCards: true,
    anonymousEnabled: true,
    hideCardTextDuringCreation: true,
    likesPerUser: 3,
    dislikesPerUser: 3,
    likeIcon: 'peach',
    dislikeIcon: 'eggplant',
    dislikesEnabled: true,
    musicEnabled: true,
    retroRatingEnabled: true,
    sprintVipEnabled: true,
    drawingEnabled: true,
    cardEditingEnabled: true,
    chatEnabled: true,
    readyEnabled: true,
    facilitatorEnabled: false,
    backgroundImage: ''
};
const MAX_BACKGROUND_IMAGE_LENGTH = 3 * 1024 * 1024;
const normalizeBackgroundImage = (value) => {
    if (typeof value !== 'string')
        return '';
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_BACKGROUND_IMAGE_LENGTH)
        return '';
    if (/^https?:\/\//i.test(trimmed))
        return trimmed;
    if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed))
        return trimmed;
    if (/^\/(?:api\/)?uploads\/[a-zA-Z0-9._-]+$/.test(trimmed))
        return trimmed;
    return '';
};
exports.normalizeBackgroundImage = normalizeBackgroundImage;
const isVoteLimit = (value) => typeof value === 'number' && Number.isInteger(value) && value >= types_1.MIN_VOTE_LIMIT && value <= types_1.MAX_VOTE_LIMIT;
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const legacyVotesPerUser = raw === null || raw === void 0 ? void 0 : raw.votesPerUser;
    const likeIcon = raw === null || raw === void 0 ? void 0 : raw.likeIcon;
    const dislikeIcon = raw === null || raw === void 0 ? void 0 : raw.dislikeIcon;
    return {
        mediaEnabled: (_a = raw === null || raw === void 0 ? void 0 : raw.mediaEnabled) !== null && _a !== void 0 ? _a : exports.DEFAULT_ROOM_FEATURES.mediaEnabled,
        reactionsEnabled: (_b = raw === null || raw === void 0 ? void 0 : raw.reactionsEnabled) !== null && _b !== void 0 ? _b : exports.DEFAULT_ROOM_FEATURES.reactionsEnabled,
        commentsEnabled: (_c = raw === null || raw === void 0 ? void 0 : raw.commentsEnabled) !== null && _c !== void 0 ? _c : exports.DEFAULT_ROOM_FEATURES.commentsEnabled,
        moveCardsEnabled: (_d = raw === null || raw === void 0 ? void 0 : raw.moveCardsEnabled) !== null && _d !== void 0 ? _d : exports.DEFAULT_ROOM_FEATURES.moveCardsEnabled,
        membersCanAddCards: (_e = raw === null || raw === void 0 ? void 0 : raw.membersCanAddCards) !== null && _e !== void 0 ? _e : exports.DEFAULT_ROOM_FEATURES.membersCanAddCards,
        anonymousEnabled: resolveAnonymousEnabled(raw),
        hideCardTextDuringCreation: (_f = raw === null || raw === void 0 ? void 0 : raw.hideCardTextDuringCreation) !== null && _f !== void 0 ? _f : exports.DEFAULT_ROOM_FEATURES.hideCardTextDuringCreation,
        likesPerUser: resolveVoteLimit(raw === null || raw === void 0 ? void 0 : raw.likesPerUser, legacyVotesPerUser, exports.DEFAULT_ROOM_FEATURES.likesPerUser),
        dislikesPerUser: resolveVoteLimit(raw === null || raw === void 0 ? void 0 : raw.dislikesPerUser, legacyVotesPerUser, exports.DEFAULT_ROOM_FEATURES.dislikesPerUser),
        likeIcon: (0, types_1.isLikeIconId)(likeIcon) ? likeIcon : exports.DEFAULT_ROOM_FEATURES.likeIcon,
        dislikeIcon: (0, types_1.isDislikeIconId)(dislikeIcon) ? dislikeIcon : exports.DEFAULT_ROOM_FEATURES.dislikeIcon,
        dislikesEnabled: (_g = raw === null || raw === void 0 ? void 0 : raw.dislikesEnabled) !== null && _g !== void 0 ? _g : exports.DEFAULT_ROOM_FEATURES.dislikesEnabled,
        musicEnabled: (_h = raw === null || raw === void 0 ? void 0 : raw.musicEnabled) !== null && _h !== void 0 ? _h : exports.DEFAULT_ROOM_FEATURES.musicEnabled,
        retroRatingEnabled: (_j = raw === null || raw === void 0 ? void 0 : raw.retroRatingEnabled) !== null && _j !== void 0 ? _j : exports.DEFAULT_ROOM_FEATURES.retroRatingEnabled,
        sprintVipEnabled: (_k = raw === null || raw === void 0 ? void 0 : raw.sprintVipEnabled) !== null && _k !== void 0 ? _k : exports.DEFAULT_ROOM_FEATURES.sprintVipEnabled,
        drawingEnabled: (_l = raw === null || raw === void 0 ? void 0 : raw.drawingEnabled) !== null && _l !== void 0 ? _l : exports.DEFAULT_ROOM_FEATURES.drawingEnabled,
        cardEditingEnabled: (_m = raw === null || raw === void 0 ? void 0 : raw.cardEditingEnabled) !== null && _m !== void 0 ? _m : exports.DEFAULT_ROOM_FEATURES.cardEditingEnabled,
        chatEnabled: (_o = raw === null || raw === void 0 ? void 0 : raw.chatEnabled) !== null && _o !== void 0 ? _o : exports.DEFAULT_ROOM_FEATURES.chatEnabled,
        readyEnabled: (_p = raw === null || raw === void 0 ? void 0 : raw.readyEnabled) !== null && _p !== void 0 ? _p : exports.DEFAULT_ROOM_FEATURES.readyEnabled,
        facilitatorEnabled: (_q = raw === null || raw === void 0 ? void 0 : raw.facilitatorEnabled) !== null && _q !== void 0 ? _q : exports.DEFAULT_ROOM_FEATURES.facilitatorEnabled,
        backgroundImage: (0, exports.normalizeBackgroundImage)(raw === null || raw === void 0 ? void 0 : raw.backgroundImage)
    };
};
exports.normalizeRoomFeatures = normalizeRoomFeatures;
