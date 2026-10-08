const FEMININE_VOWEL = /[аеёиоуыэюяaeiouy]$/i;

const normalizeNamePart = (part: string): string => part.trim().toLowerCase().replace(/ё/g, 'е');

export const isFemininePersonName = (fullName: string | undefined | null): boolean => {
  const parts = (fullName || '').trim().split(/\s+/).map(normalizeNamePart).filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.some((part) => part.endsWith('вна') || part.endsWith('вовна'))) return true;
  const givenName = parts.length >= 2 ? parts[1] : parts[0];
  return FEMININE_VOWEL.test(givenName);
};
