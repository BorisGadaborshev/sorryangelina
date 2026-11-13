import { logger } from '../utils/logger';

const POLZA_URL = 'https://polza.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-5-nano';
const REQUEST_TIMEOUT_MS = 8000;

export type CharadesDifficulty = 1 | 2 | 3;

const FALLBACK_BY_LEVEL: Record<CharadesDifficulty, string[]> = {
  1: [
    'кошка', 'зонт', 'велосипед', 'пицца', 'гитара', 'чайник', 'самолёт', 'кактус',
    'пингвин', 'мороженое', 'барабан', 'жираф', 'бабочка', 'коньки', 'чемодан',
    'робот', 'фонарик', 'скейтборд', 'панда', 'варенье', 'пылесос', 'трактор'
  ],
  2: [
    'гроза', 'водопад', 'рассвет', 'метель', 'фейерверк', 'землетрясение', 'прилив',
    'эхо', 'мираж', 'карнавал', 'пробка', 'совещание', 'дедлайн', 'удалёнка',
    'пожарный', 'подводная лодка', 'воздушный шар', 'карусель', 'вулкан', 'радуга',
    'телескоп', 'компас'
  ],
  3: [
    'ностальгия', 'дежавю', 'бессонница', 'вдохновение', 'паника', 'гордость',
    'скука', 'зависть', 'стыд', 'надежда', 'эйфория', 'хаос', 'равновесие',
    'гравитация', 'вакуум', 'интрига', 'сарказм', 'прокрастинация', 'выгорание',
    'недопонимание', 'одиночество', 'предчувствие', 'резонанс', 'инерция'
  ]
};

const LEVEL_RULES: Record<CharadesDifficulty, string> = {
  1: `Уровень 1, лёгкий.
Бери конкретные вещи: предметы, животные, еда, транспорт, спорт.
Слово должно быть легко нарисовать одной сценой.`,
  2: `Уровень 2, средний.
Бери профессии, действия, природные явления, ситуации и процессы.
Можно словосочетание из 2 слов. Всё ещё можно показать рисунком или жестом.`,
  3: `Уровень 3, сложный.
Бери эмоции, состояния, абстрактные явления, отношения и метафоры: например зависть, дежавю, выгорание, гравитация.
Без имён собственных и мата. Слово всё ещё можно намекнуть рисунком, но оно не должно быть очевидным предметом.`
};

export const charadesDifficulty = (guessedCount: number): CharadesDifficulty => {
  if (guessedCount >= 6) return 3;
  if (guessedCount >= 3) return 2;
  return 1;
};

const SYSTEM_PROMPT = `Ты ведущий шарад для командной ретроспективы.
Ответ — короткий JSON: {"word":"..."}.
Общие правила:
- одно русское нарицательное слово или короткое словосочетание из 2 слов;
- 3–24 буквы с пробелами;
- без имён собственных и мата;
- не повторяй слова из списка used.
Сложность растёт с числом угаданных слов. Следуй правилам текущего уровня.`;

const parseWord = (content: string): string | null => {
  const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as { word?: unknown };
      if (typeof parsed.word === 'string') {
        const word = parsed.word.trim().replace(/\s+/g, ' ');
        if (word.length >= 3 && word.length <= 40) return word;
      }
    } catch {
      // Fallback list below.
    }
  }
  return null;
};

const unusedFrom = (words: string[], used: Set<string>): string[] =>
  words.filter((word) => !used.has(word.toLocaleLowerCase('ru-RU')));

export const pickCharadesFallbackWord = (usedWords: string[], guessedCount: number): string => {
  const used = new Set(usedWords.map((word) => word.toLocaleLowerCase('ru-RU')));
  const level = charadesDifficulty(guessedCount);
  const preferred = unusedFrom(FALLBACK_BY_LEVEL[level], used);
  if (preferred.length > 0) {
    return preferred[Math.floor(Math.random() * preferred.length)];
  }
  const rest = unusedFrom(
    [...FALLBACK_BY_LEVEL[1], ...FALLBACK_BY_LEVEL[2], ...FALLBACK_BY_LEVEL[3]],
    used
  );
  const pool = rest.length > 0 ? rest : FALLBACK_BY_LEVEL[level];
  return pool[Math.floor(Math.random() * pool.length)];
};

export const pickCharadesWord = async (usedWords: string[], guessedCount = 0): Promise<string> => {
  const used = new Set(usedWords.map((word) => word.toLocaleLowerCase('ru-RU')));
  const difficulty = charadesDifficulty(guessedCount);
  const apiKey = process.env.POLZA_API_KEY?.trim();
  if (!apiKey) return pickCharadesFallbackWord(usedWords, guessedCount);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(POLZA_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.95,
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n${LEVEL_RULES[difficulty]}` },
          {
            role: 'user',
            content: JSON.stringify({
              difficulty,
              guessed: guessedCount,
              used: Array.from(used).slice(-40)
            })
          }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`Polza HTTP ${response.status}`);
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    const word = typeof content === 'string' ? parseWord(content) : null;
    if (word && !used.has(word.toLocaleLowerCase('ru-RU'))) return word;
    if (word) return word;
  } catch (error) {
    logger.warn({ err: error }, 'charades word request failed, using fallback');
  } finally {
    clearTimeout(timeout);
  }
  return pickCharadesFallbackWord(usedWords, guessedCount);
};
