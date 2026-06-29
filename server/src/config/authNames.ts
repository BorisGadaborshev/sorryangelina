export const FIXED_AUTH_NAMES: string[] = [
  'Коваль Ангелина Константиновна',
  'Сурогатов Денис Викторович',
  'Гадаборшев Борис Русланович',
  'Осенов Денис Дмитриевич',
  'Ивахненко Иван Романович',
  'Смоляницкая Александра Владимировна',
  'Чиненкова Вера Николаевна',
  'Острогожская Анастасия Игоревна',
  'Прохоров Андрей Евгеньевич',
  'Акимова Анастасия Александровна'
];

export const normalizeAuthName = (name: string): string => name.trim().replace(/\s+/g, ' ');

export const isFixedAuthName = (name: string): boolean => {
  const normalized = normalizeAuthName(name);
  return FIXED_AUTH_NAMES.includes(normalized);
};
