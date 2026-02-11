"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFixedAuthName = exports.normalizeAuthName = exports.FIXED_AUTH_NAMES = void 0;
exports.FIXED_AUTH_NAMES = [
    'Коваль Ангелина Константиновна',
    'Сурогатов Денис Викторович',
    'Гадаборшев Борис Русланович',
    'Осенов Денис Дмитриевич',
    'Ивахненко Иван Романович',
    'Смоляницкая Александра Владимировна',
    'Чиненкова Вера Николаевна',
    'Острогожская Анастасия Игоревна',
    'Прохоров Андрей Евгеньевич',
    'Обозный Сергей Павлович',
    'Савичева Екатерина Владимировна'
];
const normalizeAuthName = (name) => name.trim().replace(/\s+/g, ' ');
exports.normalizeAuthName = normalizeAuthName;
const isFixedAuthName = (name) => {
    const normalized = (0, exports.normalizeAuthName)(name);
    return exports.FIXED_AUTH_NAMES.includes(normalized);
};
exports.isFixedAuthName = isFixedAuthName;
