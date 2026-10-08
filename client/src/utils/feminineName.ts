const FEMININE_VOWEL = /[аеёиоуыэюяaeiouy]$/i;

const MASCULINE_GIVEN_NAMES = new Set([
  'илья',
  'фома',
  'лука',
  'добрыня',
  'никита',
  'савва',
  'кузьма',
  'данила'
]);

const FEMININE_GIVEN_NAMES = new Set([
  'любовь',
  'айшат',
  'марьям',
  'адель'
]);

const normalizeNamePart = (part: string): string => part.trim().toLowerCase().replace(/ё/g, 'е');

export const isFemininePersonName = (fullName: string | undefined | null): boolean => {
  const parts = (fullName || '').trim().split(/\s+/).map(normalizeNamePart).filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.some((part) => part.endsWith('вна') || part.endsWith('вовна'))) return true;
  if (parts.slice(0, 2).some((part) => FEMININE_GIVEN_NAMES.has(part))) return true;
  if (parts.slice(0, 2).some((part) => MASCULINE_GIVEN_NAMES.has(part))) return false;
  const givenName = parts.length >= 2 ? parts[1] : parts[0];
  return FEMININE_VOWEL.test(givenName);
};
