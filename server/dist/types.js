"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeCardTexts = exports.joinCardTextSegments = exports.getCardTextSegments = exports.CARD_TEXT_SEGMENT_SEPARATOR = exports.CARD_REACTION_EMOJIS = exports.isDislikeIconId = exports.isLikeIconId = exports.DISLIKE_ICON_IDS = exports.LIKE_ICON_IDS = exports.MAX_VOTE_LIMIT = exports.MIN_VOTE_LIMIT = exports.normalizeColumnColors = exports.DEFAULT_COLUMN_COLORS = exports.LETS_DO_COLUMN_INDEX = exports.COLUMN_COUNT = exports.DEFAULT_COLUMN_TITLES = exports.getCardTypeByColumn = exports.getTemplateColumn = exports.getColumnCount = exports.getRetroTemplate = exports.isRetroTemplateId = exports.RETRO_TEMPLATES = exports.isColumnColorId = exports.COLUMN_COLOR_IDS = void 0;
exports.COLUMN_COLOR_IDS = [
    'none',
    'teal',
    'pink',
    'purple',
    'blue',
    'indigo',
    'cyan',
    'green',
    'amber',
    'orange',
    'slate'
];
const isColumnColorId = (value) => typeof value === 'string' && exports.COLUMN_COLOR_IDS.includes(value);
exports.isColumnColorId = isColumnColorId;
exports.RETRO_TEMPLATES = {
    classic: {
        id: 'classic',
        name: 'Классика',
        description: 'Что получилось, что мешало и какие действия берём',
        actionColumnIndex: 2,
        columns: [
            { title: 'Было хорошо', hint: 'Что получилось хорошо и стоит повторить?', color: 'teal', kind: 'positive' },
            { title: 'Было не очень', hint: 'Что мешало и что хочется изменить?', color: 'pink', kind: 'negative' },
            { title: 'А, давайте', hint: 'Какие конкретные действия сделаем дальше?', color: 'blue', kind: 'suggestion' }
        ]
    },
    'start-stop-continue': {
        id: 'start-stop-continue',
        name: 'Start / Stop / Continue',
        description: 'Что начать, что прекратить и что продолжить',
        actionColumnIndex: 0,
        columns: [
            { title: 'Start', hint: 'Какие новые практики помогут работать эффективнее?', color: 'green', kind: 'suggestion' },
            { title: 'Stop', hint: 'От чего стоит отказаться?', color: 'pink', kind: 'negative' },
            { title: 'Continue', hint: 'Что уже работает и нужно продолжать?', color: 'teal', kind: 'positive' }
        ]
    },
    sailboat: {
        id: 'sailboat',
        name: 'Парусник',
        description: 'Что двигает вперёд, что тормозит, какие риски и куда плывём',
        actionColumnIndex: 3,
        columns: [
            { title: 'Паруса', hint: 'Что помогает нам двигаться вперёд?', color: 'teal', kind: 'positive' },
            { title: 'Якоря', hint: 'Что нас тормозит?', color: 'slate', kind: 'negative' },
            { title: 'Рифы', hint: 'Какие риски могут помешать?', color: 'orange', kind: 'negative' },
            { title: 'Земля', hint: 'К какому результату мы идём?', color: 'blue', kind: 'suggestion' }
        ]
    },
    'four-ls': {
        id: 'four-ls',
        name: '4L',
        description: 'Что понравилось, чему научились, чего не хватило и чего хотим',
        actionColumnIndex: 3,
        columns: [
            { title: 'Liked', hint: 'Что понравилось в этом спринте?', color: 'teal', kind: 'positive' },
            { title: 'Learned', hint: 'Чему мы научились?', color: 'cyan', kind: 'positive' },
            { title: 'Lacked', hint: 'Чего нам не хватало?', color: 'pink', kind: 'negative' },
            { title: 'Longed For', hint: 'Чего хотим в следующий раз?', color: 'purple', kind: 'suggestion' }
        ]
    },
    'traffic-light': {
        id: 'traffic-light',
        name: 'Светофор',
        description: 'Зелёный, жёлтый и красный, затем дорожная карта',
        actionColumnIndex: null,
        columns: [
            { title: 'Зелёный', hint: 'Что продолжаем делать?', color: 'green', kind: 'positive' },
            { title: 'Жёлтый', hint: 'Что нужно изменить?', color: 'amber', kind: 'negative' },
            { title: 'Красный', hint: 'Что нужно прекратить?', color: 'pink', kind: 'negative' }
        ],
        roadmapColumns: [
            { title: 'Анализ', hint: 'Почему это происходит?', color: 'indigo', kind: 'suggestion' },
            { title: 'Эксперимент', hint: 'Какой эксперимент проведём?', color: 'purple', kind: 'suggestion' },
            { title: 'Результат', hint: 'Какой результат хотим получить?', color: 'green', kind: 'suggestion' }
        ]
    }
};
const isRetroTemplateId = (value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(exports.RETRO_TEMPLATES, value);
exports.isRetroTemplateId = isRetroTemplateId;
const getRetroTemplate = (id) => (0, exports.isRetroTemplateId)(id) ? exports.RETRO_TEMPLATES[id] : exports.RETRO_TEMPLATES.classic;
exports.getRetroTemplate = getRetroTemplate;
const getColumnCount = (template) => template.columns.length;
exports.getColumnCount = getColumnCount;
const getTemplateColumn = (template, column) => {
    var _a;
    if (column >= 0 && column < template.columns.length)
        return template.columns[column];
    const roadmapIndex = column - template.columns.length;
    return (_a = template.roadmapColumns) === null || _a === void 0 ? void 0 : _a[roadmapIndex];
};
exports.getTemplateColumn = getTemplateColumn;
const getCardTypeByColumn = (template, column) => {
    var _a, _b;
    const kind = (_b = (_a = (0, exports.getTemplateColumn)(template, column)) === null || _a === void 0 ? void 0 : _a.kind) !== null && _b !== void 0 ? _b : 'positive';
    if (kind === 'negative')
        return 'disliked';
    if (kind === 'suggestion')
        return 'suggestion';
    return 'liked';
};
exports.getCardTypeByColumn = getCardTypeByColumn;
exports.DEFAULT_COLUMN_TITLES = exports.RETRO_TEMPLATES.classic.columns.map((column) => column.title);
exports.COLUMN_COUNT = exports.DEFAULT_COLUMN_TITLES.length;
exports.LETS_DO_COLUMN_INDEX = (_a = exports.RETRO_TEMPLATES.classic.actionColumnIndex) !== null && _a !== void 0 ? _a : 2;
exports.DEFAULT_COLUMN_COLORS = exports.RETRO_TEMPLATES.classic.columns.map((column) => column.color);
const normalizeColumnColors = (colors, template = exports.RETRO_TEMPLATES.classic) => {
    const defaults = template.columns.map((column) => column.color);
    if (!Array.isArray(colors) || colors.length !== defaults.length || !colors.every(exports.isColumnColorId)) {
        return defaults;
    }
    return [...colors];
};
exports.normalizeColumnColors = normalizeColumnColors;
exports.MIN_VOTE_LIMIT = 1;
exports.MAX_VOTE_LIMIT = 20;
exports.LIKE_ICON_IDS = ['peach', 'banana', 'hotPepper', 'avocado', 'pineapple', 'thumbsUp'];
exports.DISLIKE_ICON_IDS = ['eggplant', 'rottenTomato', 'grapefruit', 'egg', 'thumbsDown'];
const isLikeIconId = (value) => typeof value === 'string' && exports.LIKE_ICON_IDS.includes(value);
exports.isLikeIconId = isLikeIconId;
const isDislikeIconId = (value) => typeof value === 'string' && exports.DISLIKE_ICON_IDS.includes(value);
exports.isDislikeIconId = isDislikeIconId;
exports.CARD_REACTION_EMOJIS = ['👍', '👎', '👏', '❤️', '🔥', '🎉', '🥰', '😨', '😂'];
exports.CARD_TEXT_SEGMENT_SEPARATOR = '\u001e';
const getCardTextSegments = (text) => {
    const segments = text
        .split(exports.CARD_TEXT_SEGMENT_SEPARATOR)
        .map((part) => part.trim())
        .filter(Boolean);
    return segments.length > 0 ? segments : (text.trim() ? [text.trim()] : []);
};
exports.getCardTextSegments = getCardTextSegments;
const joinCardTextSegments = (segments) => segments.map((part) => part.trim()).filter(Boolean).join(exports.CARD_TEXT_SEGMENT_SEPARATOR);
exports.joinCardTextSegments = joinCardTextSegments;
const mergeCardTexts = (targetText, sourceText) => (0, exports.joinCardTextSegments)([...(0, exports.getCardTextSegments)(targetText), ...(0, exports.getCardTextSegments)(sourceText)]);
exports.mergeCardTexts = mergeCardTexts;
