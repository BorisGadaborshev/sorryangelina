export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'awful';
export const PHASES = ['warmup', 'creation', 'grouping', 'voting', 'discussion', 'roadmap', 'rating'] as const;
export type Phase = (typeof PHASES)[number];

export const isOrganizePhase = (phase: Phase): boolean =>
  phase === 'creation' || phase === 'grouping';

export const COLUMN_COLOR_IDS = [
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
] as const;

export type ColumnColorId = typeof COLUMN_COLOR_IDS[number];

export const isColumnColorId = (value: unknown): value is ColumnColorId =>
  typeof value === 'string' && (COLUMN_COLOR_IDS as readonly string[]).includes(value);

export const RETRO_TEMPLATE_IDS = [
  'classic',
  'went-well',
  'four-ls',
  'three-wishes',
  'flap',
  'sailboat',
  'start-stop-continue',
  'wrap',
  'starfish',
  'mad-sad-glad',
  'feedback-ladder',
  'rose-thorn-bud',
  'my-love',
  'elephant',
  'ikigai',
  'samolo',
  'kpt',
  'hopes-fears',
  'daki',
  'three-pigs',
  'traffic-light'
] as const;

export type RetroTemplateId = typeof RETRO_TEMPLATE_IDS[number];
export const RANDOM_RETRO_TEMPLATE_ID = 'random' as const;
export type RetroTemplateChoice = RetroTemplateId | typeof RANDOM_RETRO_TEMPLATE_ID;
export type ColumnKind = 'positive' | 'negative' | 'suggestion';
export type CardType = 'liked' | 'disliked' | 'suggestion';

export interface RetroTemplateColumn {
  title: string;
  hint?: string;
  tooltip?: string;
  color: ColumnColorId;
  kind: ColumnKind;
}

export interface RetroTemplate {
  id: RetroTemplateId;
  name: string;
  description: string;
  columns: RetroTemplateColumn[];
  actionColumnIndex: number | null;
  roadmapColumns: RetroTemplateColumn[];
}

export const ROADMAP_TASK_INDEX = 1;

export const getRoadmapTaskColumn = (template: RetroTemplate): number =>
  template.columns.length + ROADMAP_TASK_INDEX;

export const isRoadmapTaskColumn = (template: RetroTemplate, column: number): boolean =>
  column === getRoadmapTaskColumn(template);

export const isDiscussionCard = (card: { column: number }, template: RetroTemplate): boolean =>
  card.column >= 0 && card.column < template.columns.length;

export const sortCardsByVotes = (cards: Card[]): Card[] =>
  [...cards].sort((left, right) => {
    const scoreLeft = (left.likes?.length || 0) + (left.dislikes?.length || 0);
    const scoreRight = (right.likes?.length || 0) + (right.dislikes?.length || 0);
    return scoreRight - scoreLeft;
  });

export const getDiscussionCards = (cards: Card[], template: RetroTemplate): Card[] =>
  sortCardsByVotes(cards.filter((card) => isDiscussionCard(card, template)));

const col = (
  title: string,
  hint: string,
  color: ColumnColorId,
  kind: ColumnKind,
  tooltip?: string
): RetroTemplateColumn => (tooltip ? { title, hint, color, kind, tooltip } : { title, hint, color, kind });

export const ROADMAP_COLUMNS: RetroTemplateColumn[] = [
  {
    title: 'Анализ',
    hint: 'В чём проблема и что может её решить?',
    tooltip: 'Анализ — в чём проблема и что может её решить.',
    color: 'indigo',
    kind: 'suggestion'
  },
  {
    title: 'Задача',
    hint: 'Как проверить это на практике?',
    tooltip: 'Задача — как проверить на практике.',
    color: 'purple',
    kind: 'suggestion'
  },
  {
    title: 'Результат',
    hint: 'Что получилось после внедрения?',
    tooltip: 'Результат — что получилось после внедрения (заполняется на следующей ретроспективе).',
    color: 'green',
    kind: 'suggestion'
  }
];

export const RETRO_TEMPLATES: Record<RetroTemplateId, RetroTemplate> = {
  classic: {
    id: 'classic',
    name: 'Классика',
    description: 'Простой шаблон: что получилось, что мешало и какие действия берём дальше',
    actionColumnIndex: 2,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Было хорошо', 'Что получилось хорошо и стоит повторить?', 'teal', 'positive'),
      col('Было не очень', 'Что мешало и что хочется изменить?', 'pink', 'negative'),
      col('А, давайте', 'Какие конкретные действия сделаем дальше?', 'blue', 'suggestion')
    ]
  },
  'went-well': {
    id: 'went-well',
    name: 'Всё прошло хорошо! Всё ли?',
    description: 'Облегченный ретроспективный шаблон, ориентированный на результаты',
    actionColumnIndex: null,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Что прошло хорошо', 'Что получилось и стоит закрепить?', 'teal', 'positive'),
      col('Что пошло не так', 'Что помешало или разочаровало?', 'pink', 'negative')
    ]
  },
  'four-ls': {
    id: 'four-ls',
    name: 'Понравилось, Узнал, Не хватало, Желал',
    description: 'Простая и популярная техника, чтобы выделить положительные (понравилось и узнал) и отрицательные (не хватало и желания) моменты как с фактической, так и с эмоциональной точки зрения',
    actionColumnIndex: 3,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col(
        'Понравилось',
        'Какие события, действия или результаты вызвали положительные эмоции?',
        'teal',
        'positive',
        'Liked (понравилось, закрепляем успех).\nКакие события, действия или результаты вызвали положительные эмоции.'
      ),
      col(
        'Я узнал',
        'Чему научились, что поняли о проекте или друг о друге?',
        'cyan',
        'positive',
        'Learned (изучили, фиксируем рост).\nЧему научились, что поняли о проекте или друг о друге.'
      ),
      col(
        'Мне не хватало',
        'Какого ресурса, информации, инструмента не хватило для эффективной работы?',
        'pink',
        'negative',
        'Lacked (не хватило, выделяем дефициты).\nКакого ресурса, информации, инструмента не хватило для эффективной работы.'
      ),
      col(
        'Я желаю',
        'Какие амбициозные улучшения нужны для идеального сценария выполнения?',
        'purple',
        'suggestion',
        'Longed For (желаемое, формулируем потребности).\nКакие амбициозные улучшения нужны для идеального сценария выполнения.'
      )
    ]
  },
  'three-wishes': {
    id: 'three-wishes',
    name: 'Три желания',
    description: 'Представьте, что лампа Аладдина у вас в руках. Готовы загадать три желания?',
    actionColumnIndex: 0,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Желаю для себя', 'Какое желание загадать для себя?', 'purple', 'suggestion'),
      col('Желаю для команды', 'Какое желание загадать для команды?', 'blue', 'suggestion'),
      col('Желаю для всего мира', 'Какое желание загадать для всего мира?', 'teal', 'suggestion')
    ]
  },
  flap: {
    id: 'flap',
    name: 'FLAP (Future, Lessons, Accomplishments, Problems)',
    description: 'Гибрид «взгляд вперёд + ретро»; помогает связать уроки с планами на будущее',
    actionColumnIndex: 0,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Взгляд в будущее', 'Куда хотим двигаться дальше?', 'blue', 'suggestion'),
      col('Извлечённые уроки', 'Чему научились за этот период?', 'cyan', 'positive'),
      col('Достижения', 'Чем гордимся и что получилось?', 'teal', 'positive'),
      col('Проблемные зоны', 'Что мешало и где были сбои?', 'pink', 'negative')
    ]
  },
  sailboat: {
    id: 'sailboat',
    name: 'Парусник',
    description: 'Это не ретро. Это — футуретро! Метафора приключения помогает прийти к интересным целям и решениям',
    actionColumnIndex: 3,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col(
        'Паруса',
        'Что даёт энергию и ускоряет процессы?',
        'teal',
        'positive',
        'Паруса (движущая сила).\nДают энергию и ускоряют процессы — успешные практики, мотивация, инструменты.'
      ),
      col(
        'Якоря',
        'Что замедляет или останавливает работу?',
        'slate',
        'negative',
        'Якоря (тормозящие факторы).\nЗамедляют или останавливают работу — рутина, блокеры, бюрократия, ошибки.'
      ),
      col(
        'Рифы',
        'Что может пойти не так?',
        'orange',
        'negative',
        'Рифы (риски).\nПоказывают, что может пойти не так — препятствия, ограничения, внешние угрозы.'
      ),
      col(
        'Земля',
        'К какому результату плывёт команда?',
        'blue',
        'suggestion',
        'Земля (цели).\nУказывают на результат, к которому «плывёт» команда — видение команды, цель спринта или проекта.'
      )
    ]
  },
  'start-stop-continue': {
    id: 'start-stop-continue',
    name: 'Начать, Прекратить, Продолжить',
    description: 'Классическая, но в то же время эффективная техника для оценки текущей деятельности и разработки плана действий на будущее',
    actionColumnIndex: 0,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col(
        'Начать',
        'Какие новые практики, инструменты и подходы помогут работать эффективнее?',
        'green',
        'suggestion',
        'Start (начать).\nКакие новые практики, инструменты и подходы помогут работать эффективнее?'
      ),
      col(
        'Прекратить',
        'От каких действий, встреч или сложившихся практик нужно отказаться?',
        'pink',
        'negative',
        'Stop (прекратить).\nОт каких действий, встреч или сложившихся практик нужно отказаться, потому что они тратят время, демотивируют и не несут пользы?'
      ),
      col(
        'Продолжить',
        'Какие существующие практики отлично работают, и нужно их сохранить?',
        'teal',
        'positive',
        'Continue (продолжить).\nКакие существующие практики отлично работают, и нужно их сохранить?'
      )
    ]
  },
  wrap: {
    id: 'wrap',
    name: 'WRAP (Wishes, Risks, Appreciations, Puzzles)',
    description: 'Помогает поддерживать командный дух и вовремя замечать угрозы',
    actionColumnIndex: 0,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Пожелания', 'Чего хотим для себя и команды?', 'blue', 'suggestion'),
      col('Риски', 'Какие угрозы уже видны или могут появиться?', 'orange', 'negative'),
      col('Благодарности', 'Кому и за что благодарны?', 'teal', 'positive'),
      col('Вопросы', 'Что осталось непонятным и требует разбора?', 'purple', 'negative')
    ]
  },
  starfish: {
    id: 'starfish',
    name: 'Морская звезда',
    description: 'Формат для тонкой настройки командной работы: что начать, что прекратить, что продолжать, чего делать больше и чего — меньше. Полезно, когда «Начать-Прекратить-Продолжать» кажется слишком грубым',
    actionColumnIndex: 0,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Начать', 'Какие новые практики стоит попробовать?', 'green', 'suggestion'),
      col('Прекратить', 'От чего отказываемся, потому что это мешает?', 'pink', 'negative'),
      col('Сохранить', 'Что работает и должно остаться как есть?', 'teal', 'positive'),
      col('Больше', 'Чего хотим делать чаще или сильнее?', 'cyan', 'suggestion'),
      col('Меньше', 'Чего хотим делать реже или слабее?', 'amber', 'negative')
    ]
  },
  'mad-sad-glad': {
    id: 'mad-sad-glad',
    name: 'Бесит, Печалит, Радует',
    description: 'Классический ретроспективный шаблон для раскрытия эмоций',
    actionColumnIndex: null,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Бесит', 'Что злит, раздражает или выматывает?', 'pink', 'negative'),
      col('Печалит', 'Что расстроило или вызвало тревогу?', 'purple', 'negative'),
      col('Радует', 'Что порадовало и дало энергию?', 'teal', 'positive')
    ]
  },
  'feedback-ladder': {
    id: 'feedback-ladder',
    name: 'Лестница обратной связи',
    description: 'Структурированный цикл обратной связи по работе/продукту; помогает демо-ориентированным командам собирать конструктивную критику',
    actionColumnIndex: 3,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Уточнить', 'Что нужно прояснить, прежде чем судить?', 'cyan', 'suggestion'),
      col('Ценность', 'Что уже ценно и стоит сохранить?', 'teal', 'positive'),
      col('Опасения', 'Что вызывает сомнения или риски?', 'orange', 'negative'),
      col('Предложения', 'Какие конкретные улучшения предлагаем?', 'blue', 'suggestion')
    ]
  },
  'rose-thorn-bud': {
    id: 'rose-thorn-bud',
    name: 'Роза-Шип-Бутон',
    description: 'Простая метафора для позитивных моментов, вызовов и возможностей; подходит для смешанных аудиторий',
    actionColumnIndex: 2,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Роза', 'Что получилось красиво и хочется сохранить?', 'pink', 'positive'),
      col('Шип', 'Что царапало, мешало или болело?', 'slate', 'negative'),
      col('Бутон', 'Какие возможности только начинают раскрываться?', 'green', 'suggestion')
    ]
  },
  'my-love': {
    id: 'my-love',
    name: 'Моя любовь',
    description: 'Интересное упражнение в проявлении эмоций и пожеланий друг другу',
    actionColumnIndex: 2,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Я полюбил', 'Что полюбили в работе, процессе или команде?', 'pink', 'positive'),
      col('Мне разбило сердце', 'Что расстроило или подвело?', 'purple', 'negative'),
      col('Валентинки', 'Какие тёплые пожелания хочется передать?', 'teal', 'suggestion')
    ]
  },
  elephant: {
    id: 'elephant',
    name: 'Слон в комнате',
    description: 'Помогает обозначить замалчиваемую проблему, тормозящую прогресс. Используйте при напряжении или избегании, чтобы согласовать понимание последствий, эмоций и корневых причин',
    actionColumnIndex: 3,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Слон в комнате', 'О какой неудобной теме все молчат?', 'slate', 'negative'),
      col('Последствия', 'К чему это уже приводит?', 'orange', 'negative'),
      col('Чувства', 'Что люди чувствуют вокруг этой темы?', 'purple', 'negative'),
      col('Но почему?', 'Почему это происходит и что с этим делать?', 'blue', 'suggestion')
    ]
  },
  ikigai: {
    id: 'ikigai',
    name: 'Икигай',
    description: 'Командное упражнение для выявления сильных сторон и фокусировки: оцениваем активности по четырём измерениям и обсуждаем пересечения',
    actionColumnIndex: 2,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Что мы любим', 'Какие активности заряжают команду?', 'pink', 'positive'),
      col('В чём мы сильны', 'Где команда особенно хороша?', 'teal', 'positive'),
      col('Что приносит больше ценности', 'Где наш вклад наиболее полезен?', 'blue', 'suggestion'),
      col('Что даёт больший охват', 'Что масштабируется и затрагивает больше людей?', 'purple', 'suggestion')
    ]
  },
  samolo: {
    id: 'samolo',
    name: 'SaMoLo (Same, More, Less)',
    description: 'Лёгкая проверка пульса, когда важнее направление, чем глубокая диагностика',
    actionColumnIndex: 1,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Оставляем', 'Что оставляем без изменений?', 'teal', 'positive'),
      col('Больше', 'Чего хотим больше?', 'green', 'suggestion'),
      col('Меньше', 'Чего хотим меньше?', 'pink', 'negative')
    ]
  },
  kpt: {
    id: 'kpt',
    name: 'KPT (Keep, Problem, Try)',
    description: 'Быстрый, точечный цикл улучшений; идеален для коротких спринтов и загруженных команд',
    actionColumnIndex: 2,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Сохранить', 'Что работает и оставляем?', 'teal', 'positive'),
      col('Проблемы', 'Что сломалось или мешает?', 'pink', 'negative'),
      col('Попробовать', 'Какой маленький эксперимент запустим?', 'blue', 'suggestion')
    ]
  },
  'hopes-fears': {
    id: 'hopes-fears',
    name: 'Надежды и опасения',
    description: 'Создаём доверие и выравниваем ожидания на старте или после сложного спринта: делимся надеждами и тревогами',
    actionColumnIndex: null,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Надежды', 'На что надеемся в следующем периоде?', 'teal', 'positive'),
      col('Опасения', 'Чего боимся и что может пойти не так?', 'orange', 'negative')
    ]
  },
  daki: {
    id: 'daki',
    name: 'DAKI (Drop, Add, Keep, Improve)',
    description: '«Генеральная уборка»! Особенно уместна после разрастания процессов или чехарды с инструментами',
    actionColumnIndex: 1,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Отбросить', 'От чего отказываемся?', 'pink', 'negative'),
      col('Добавить', 'Что стоит ввести?', 'green', 'suggestion'),
      col('Сохранить', 'Что оставляем как есть?', 'teal', 'positive'),
      col('Улучшить', 'Что уже есть, но можно сделать лучше?', 'blue', 'suggestion')
    ]
  },
  'three-pigs': {
    id: 'three-pigs',
    name: 'Три поросёнка',
    description: 'Разложите работу по «прочности», чтобы наметить быстрые и долгосрочные улучшения',
    actionColumnIndex: 2,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col('Солома', 'Что хрупкое и развалится от первого ветра?', 'amber', 'negative'),
      col('Дерево', 'Что держится, но ещё ненадёжно?', 'orange', 'negative'),
      col('Кирпич', 'Что построено крепко и стоит сохранить?', 'slate', 'positive')
    ]
  },
  'traffic-light': {
    id: 'traffic-light',
    name: 'Светофор',
    description: 'Три сигнала по состоянию работы: что держать, за чем следить и что чинить',
    actionColumnIndex: null,
    roadmapColumns: ROADMAP_COLUMNS,
    columns: [
      col(
        'Зелёный',
        'Что работает отлично и не требует изменений?',
        'green',
        'positive',
        '🟢 Зелёный — работает отлично и не требует изменений.'
      ),
      col(
        'Жёлтый',
        'Что работает с напряжением и требует постоянного контроля?',
        'amber',
        'negative',
        '🟡 Жёлтый — работает с напряжением и требует постоянного контроля.'
      ),
      col(
        'Красный',
        'Что работает плохо, постоянно мешает и требует вмешательства?',
        'pink',
        'negative',
        '🔴 Красный — работает плохо, постоянно мешает и требует вмешательства.'
      )
    ]
  }
};

export const isRetroTemplateId = (value: unknown): value is RetroTemplateId =>
  typeof value === 'string' && (RETRO_TEMPLATE_IDS as readonly string[]).includes(value);

export const isRetroTemplateChoice = (value: unknown): value is RetroTemplateChoice =>
  value === RANDOM_RETRO_TEMPLATE_ID || isRetroTemplateId(value);

export const pickRandomRetroTemplateId = (): RetroTemplateId => {
  const index = Math.floor(Math.random() * RETRO_TEMPLATE_IDS.length);
  return RETRO_TEMPLATE_IDS[index] ?? 'classic';
};

export const resolveRetroTemplateId = (value?: string | null): RetroTemplateId => {
  if (value === RANDOM_RETRO_TEMPLATE_ID) return pickRandomRetroTemplateId();
  return isRetroTemplateId(value) ? value : 'classic';
};

export const getRetroTemplate = (id?: string | null): RetroTemplate =>
  isRetroTemplateId(id) ? RETRO_TEMPLATES[id] : RETRO_TEMPLATES.classic;

export const RANDOM_RETRO_TEMPLATE_OPTION = {
  id: RANDOM_RETRO_TEMPLATE_ID,
  name: 'Случайный',
  description: 'Не знаете какой шаблон выбрать? Пусть это будет сюрприз! Лучший выбор для вечных комнат — каждый раз новый шаблон',
  columns: [] as RetroTemplateColumn[]
};

export const RETRO_TEMPLATE_LIST: RetroTemplate[] = RETRO_TEMPLATE_IDS.map((id) => RETRO_TEMPLATES[id]);

export const RETRO_TEMPLATE_PICKER = [
  ...RETRO_TEMPLATE_LIST,
  RANDOM_RETRO_TEMPLATE_OPTION
];

export const getColumnCount = (template: RetroTemplate): number => template.columns.length;

export const getTemplateColumn = (template: RetroTemplate, column: number): RetroTemplateColumn | undefined => {
  if (column >= 0 && column < template.columns.length) return template.columns[column];
  const roadmapIndex = column - template.columns.length;
  return template.roadmapColumns?.[roadmapIndex];
};

export const getCardTypeByColumn = (template: RetroTemplate, column: number): CardType => {
  const kind = getTemplateColumn(template, column)?.kind ?? 'positive';
  if (kind === 'negative') return 'disliked';
  if (kind === 'suggestion') return 'suggestion';
  return 'liked';
};

export const DEFAULT_COLUMN_TITLES = RETRO_TEMPLATES.classic.columns.map((column) => column.title);
export const COLUMN_COUNT = DEFAULT_COLUMN_TITLES.length;
export const LETS_DO_COLUMN_INDEX = RETRO_TEMPLATES.classic.actionColumnIndex ?? 2;
export const DEFAULT_COLUMN_COLORS: ColumnColorId[] = RETRO_TEMPLATES.classic.columns.map((column) => column.color);

export const normalizeColumnColors = (
  colors?: string[] | null,
  template: RetroTemplate = RETRO_TEMPLATES.classic
): ColumnColorId[] => {
  const defaults = template.columns.map((column) => column.color);
  if (!Array.isArray(colors) || colors.length !== defaults.length || !colors.every(isColumnColorId)) {
    return defaults;
  }
  return [...colors];
};

export const MIN_VOTE_LIMIT = 1;
export const MAX_VOTE_LIMIT = 20;
export type VoteLimit = number;

export const LIKE_ICON_IDS = ['peach', 'banana', 'hotPepper', 'avocado', 'pineapple', 'thumbsUp'] as const;
export type LikeIconId = typeof LIKE_ICON_IDS[number];

export const DISLIKE_ICON_IDS = ['eggplant', 'rottenTomato', 'grapefruit', 'egg', 'thumbsDown'] as const;
export type DislikeIconId = typeof DISLIKE_ICON_IDS[number];

export const isLikeIconId = (value: unknown): value is LikeIconId =>
  typeof value === 'string' && (LIKE_ICON_IDS as readonly string[]).includes(value);

export const isDislikeIconId = (value: unknown): value is DislikeIconId =>
  typeof value === 'string' && (DISLIKE_ICON_IDS as readonly string[]).includes(value);

export interface RoomFeatures {
  mediaEnabled: boolean;
  reactionsEnabled: boolean;
  commentsEnabled: boolean;
  moveCardsEnabled: boolean;
  membersCanAddCards: boolean;
  anonymousEnabled: boolean;
  hideCardTextDuringCreation: boolean;
  likesPerUser: VoteLimit;
  dislikesPerUser: VoteLimit;
  likeIcon: LikeIconId;
  dislikeIcon: DislikeIconId;
  dislikesEnabled: boolean;
  musicEnabled: boolean;
  groupingEnabled: boolean;
  roadmapEnabled: boolean;
  retroRatingEnabled: boolean;
  sprintVipEnabled: boolean;
  drawingEnabled: boolean;
  arkanoidEnabled: boolean;
  cardEditingEnabled: boolean;
  chatEnabled: boolean;
  readyEnabled: boolean;
  facilitatorEnabled: boolean;
  discussionActionsEnabled: boolean;
  contentModerationEnabled: boolean;
  backgroundImage: string;
}

export const DEFAULT_ROOM_FEATURES: RoomFeatures = {
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
  groupingEnabled: true,
  roadmapEnabled: true,
  retroRatingEnabled: true,
  sprintVipEnabled: true,
  drawingEnabled: true,
  arkanoidEnabled: true,
  cardEditingEnabled: true,
  chatEnabled: true,
  readyEnabled: true,
  facilitatorEnabled: false,
  discussionActionsEnabled: true,
  contentModerationEnabled: false,
  backgroundImage: ''
};

export interface User {
  id: string;
  name: string;
  roomId: string;
  role: 'admin' | 'user';
  isReady?: boolean;
  mood?: Mood;
}

export interface CardComment {
  id: string;
  cardId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CardReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export const CARD_REACTION_EMOJIS = ['👍', '👎', '👏', '❤️', '🔥', '🎉', '🥰', '😨', '😂'] as const;
export type CardReactionEmoji = typeof CARD_REACTION_EMOJIS[number];

export const DISCUSSION_BURST_EMOJIS = ['😂', '😭', '😠', '👍', '👎', '😮', '🤮', '👏', '❤️', '🔥', '🎉', '🥰'] as const;
export type DiscussionBurstEmoji = typeof DISCUSSION_BURST_EMOJIS[number];

export const CARD_TEXT_SEGMENT_SEPARATOR = '\u001e';

export const getCardTextSegments = (text: string): string[] => {
  const segments = text
    .split(CARD_TEXT_SEGMENT_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments : (text.trim() ? [text.trim()] : []);
};

export const joinCardTextSegments = (segments: string[]): string =>
  segments.map((part) => part.trim()).filter(Boolean).join(CARD_TEXT_SEGMENT_SEPARATOR);

export const mergeCardTexts = (targetText: string, sourceText: string): string =>
  joinCardTextSegments([...getCardTextSegments(targetText), ...getCardTextSegments(sourceText)]);

export const alignSegmentAuthors = (
  text: string,
  createdBy: string,
  segmentAuthors?: string[] | null
): string[] => {
  const fallback = createdBy.trim();
  return getCardTextSegments(text).map((_, index) => segmentAuthors?.[index]?.trim() || fallback);
};

export const mergeSegmentAuthors = (
  targetText: string,
  targetCreatedBy: string,
  targetAuthors: string[] | undefined,
  sourceText: string,
  sourceCreatedBy: string,
  sourceAuthors: string[] | undefined
): string[] => [
  ...alignSegmentAuthors(targetText, targetCreatedBy, targetAuthors),
  ...alignSegmentAuthors(sourceText, sourceCreatedBy, sourceAuthors)
];

export const compactSegmentAuthors = (authors: string[], createdBy: string): string[] | undefined => {
  if (authors.length <= 1 && (!authors[0] || authors[0] === createdBy)) return undefined;
  return authors;
};

export const isCardSegmentAuthor = (
  card: { text: string; createdBy: string; segmentAuthors?: string[] },
  name: string
): boolean => {
  const normalized = name.trim();
  if (!normalized) return false;
  return alignSegmentAuthors(card.text, card.createdBy, card.segmentAuthors).includes(normalized);
};

export const CARD_TASK_STATUSES = [
  'analysis',
  'execution',
  'testing',
  'done',
  'closed'
] as const;

export type CardTaskStatus = (typeof CARD_TASK_STATUSES)[number];

export const DEFAULT_CARD_TASK_STATUS: CardTaskStatus = 'analysis';

export const CARD_TASK_STATUS_LABELS: Record<CardTaskStatus, string> = {
  analysis: 'Анализ',
  execution: 'Исполнение',
  testing: 'Тестирование',
  done: 'Выполнено',
  closed: 'Закрыто'
};

export const isCardTaskStatus = (value: unknown): value is CardTaskStatus =>
  typeof value === 'string' && (CARD_TASK_STATUSES as readonly string[]).includes(value);

export interface CardTask {
  assignees: string[];
  status?: CardTaskStatus;
  dueDate?: string;
  sprint?: string;
  effortDays?: number;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const isOpenCardTaskStatus = (status?: CardTaskStatus): boolean =>
  status !== 'done' && status !== 'closed';

export const isOpenRoadmapTaskCard = (card: Card, template: RetroTemplate): boolean =>
  isRoadmapTaskColumn(template, card.column) && isOpenCardTaskStatus(card.task?.status);

export interface RoomSnapshotForTaskCarry {
  id: string;
  template?: RetroTemplateId;
  cards: Card[];
}

export const selectOpenTasksFromPreviousSprints = (
  previousRoomsNewestFirst: RoomSnapshotForTaskCarry[]
): Card[] => {
  for (const room of previousRoomsNewestFirst) {
    const template = getRetroTemplate(room.template);
    const taskCards = room.cards.filter((card) => isRoadmapTaskColumn(template, card.column));
    if (taskCards.length === 0) continue;
    return taskCards.filter((card) => isOpenCardTaskStatus(card.task?.status));
  }
  return [];
};

export const cloneTaskCardForNextSprint = (
  card: Card,
  nextTemplate: RetroTemplate,
  nextId: string
): Card => {
  const column = getRoadmapTaskColumn(nextTemplate);
  const originInRange = card.originColumn != null
    && card.originColumn >= 0
    && card.originColumn < nextTemplate.columns.length;
  return {
    id: nextId,
    text: card.text,
    type: getCardTypeByColumn(nextTemplate, column),
    createdBy: card.createdBy,
    likes: [],
    dislikes: [],
    column,
    originColumn: originInRange ? card.originColumn : undefined,
    authorRevealed: card.authorRevealed,
    segmentAuthors: card.segmentAuthors,
    task: card.task
      ? { ...card.task, assignees: [...card.task.assignees] }
      : { assignees: [], status: DEFAULT_CARD_TASK_STATUS }
  };
};

export const normalizeCardTask = (raw: unknown): CardTask | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const assignees = Array.isArray(source.assignees)
    ? [...new Set(
      source.assignees
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0 && item.length <= 80)
    )].slice(0, 12)
    : [];
  const dueDate = typeof source.dueDate === 'string' && DATE_ONLY.test(source.dueDate)
    ? source.dueDate
    : undefined;
  const sprint = typeof source.sprint === 'string' ? source.sprint.trim().slice(0, 40) : '';
  const effort = Number(source.effortDays);
  const effortDays = Number.isFinite(effort) && effort > 0
    ? Math.min(100, Math.round(effort * 2) / 2)
    : undefined;
  const status = isCardTaskStatus(source.status) ? source.status : undefined;
  if (assignees.length === 0 && !dueDate && !sprint && effortDays == null && !status) return undefined;
  return {
    assignees,
    status: status ?? DEFAULT_CARD_TASK_STATUS,
    dueDate,
    sprint: sprint || undefined,
    effortDays
  };
};

export interface Card {
  id: string;
  text: string;
  type: CardType;
  createdBy: string;
  likes: string[];
  dislikes: string[];
  column: number;
  originColumn?: number;
  imageUrl?: string;
  comments?: CardComment[];
  reactions?: CardReaction[];
  authorRevealed?: boolean;
  segmentAuthors?: string[];
  task?: CardTask;
}

export interface Room {
  id: string;
  teamId?: string;
  owner: string;
  phase: Phase;
  template?: RetroTemplateId;
  columnTitles?: string[];
  columnColors?: ColumnColorId[];
  features?: RoomFeatures;
  warmupQuestions?: string[];
  createdAt?: string;
  users: User[];
  cards: Card[];
}

export interface RoomState {
  cards: Card[];
  phase: Phase;
  users: User[];
  version?: number;
  template?: RetroTemplateId;
  columnTitles?: string[];
  columnColors?: ColumnColorId[];
}

export const toRoomBoardState = (room: Room, version?: number): RoomState => ({
  cards: room.cards,
  phase: room.phase,
  users: room.users,
  template: room.template,
  columnTitles: room.columnTitles,
  columnColors: room.columnColors,
  ...(typeof version === 'number' ? { version } : {})
});

export interface PhaseTimerState {
  phase?: Phase;
  durationSeconds: number;
  remainingSeconds: number;
  running: boolean;
  endAt?: number;
}

export interface RetroRatingState {
  hasVoted: boolean;
  votesCount: number;
  totalCount: number;
  resultsVisible: boolean;
  average?: number;
  distribution?: Record<1 | 2 | 3 | 4 | 5, number>;
}

export const MAX_WARMUP_QUESTIONS = 8;
export const MAX_WARMUP_QUESTION_LENGTH = 200;
export const MAX_WARMUP_ANSWER_LENGTH = 500;

export interface WarmupState {
  questions: string[];
  submitted: boolean;
  submittedCount: number;
  totalCount: number;
  resultsVisible: boolean;
  answers?: string[][];
}

export const EMPTY_WARMUP_STATE: WarmupState = {
  questions: [],
  submitted: false,
  submittedCount: 0,
  totalCount: 0,
  resultsVisible: false
};

export const CHARADES_WARMUP_MARKER = '__charades__';

export interface CharadesScoreEntry {
  userName: string;
  score: number;
}

export type CharadesRoundStatus = 'waiting' | 'playing' | 'guessed';

export interface CharadesState {
  active: boolean;
  status: CharadesRoundStatus;
  drawerName: string | null;
  word?: string;
  winnerName?: string;
  lastWord?: string;
  round: number;
  scores: CharadesScoreEntry[];
}

export const EMPTY_CHARADES_STATE: CharadesState = {
  active: false,
  status: 'waiting',
  drawerName: null,
  round: 0,
  scores: []
};

export const isCharadesWarmup = (questions?: string[] | null): boolean =>
  Array.isArray(questions) && questions.includes(CHARADES_WARMUP_MARKER);

export const visibleWarmupQuestions = (questions: string[]): string[] =>
  questions.filter((question) => question !== CHARADES_WARMUP_MARKER);

export const normalizeCharadesText = (value: string): string =>
  value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isCorrectCharadesGuess = (guess: string, word: string): boolean => {
  const normalizedGuess = normalizeCharadesText(guess);
  const normalizedWord = normalizeCharadesText(word);
  if (!normalizedGuess || !normalizedWord) return false;
  if (normalizedGuess === normalizedWord) return true;
  if (normalizedGuess.split(' ').includes(normalizedWord)) return true;
  return normalizedWord.includes(' ') && normalizedGuess.includes(normalizedWord);
};

export const normalizeWarmupQuestions = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const questions: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const text = item.trim().replace(/\s+/g, ' ').slice(0, MAX_WARMUP_QUESTION_LENGTH);
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(text);
    if (questions.length >= MAX_WARMUP_QUESTIONS) break;
  }
  return questions;
};

export const normalizeWarmupAnswers = (raw: unknown, questionCount: number): string[] | null => {
  if (!Array.isArray(raw) || questionCount < 1 || raw.length !== questionCount) return null;
  const answers = raw.map((item) => (
    typeof item === 'string' ? item.trim().replace(/\s+/g, ' ').slice(0, MAX_WARMUP_ANSWER_LENGTH) : ''
  ));
  if (answers.some((answer) => !answer)) return null;
  return answers;
};

export const shuffleItems = <T>(items: T[]): T[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
  }
  return next;
};

export const collectAnonymousWarmupAnswers = (
  questionCount: number,
  submissions: Iterable<string[]>
): string[][] => {
  const buckets: string[][] = Array.from({ length: questionCount }, () => []);
  for (const submission of submissions) {
    for (let index = 0; index < questionCount; index += 1) {
      const answer = submission[index]?.trim();
      if (answer) buckets[index].push(answer);
    }
  }
  return buckets.map((answers) => shuffleItems(answers));
};

export interface FacilitatorAnnouncement {
  userId: string;
  userName: string;
  selectedAt: number;
}

export interface DiscussionNavigationState {
  unviewedCardIds: string[];
  viewedCardIds: string[];
}

export interface DiscussionBurst {
  id: string;
  emoji: string;
  userName: string;
}

export interface DiscussionHand {
  userName: string;
}

export interface SprintVipState {
  vipUserName?: string;
  voteCount: number;
  myVote?: string;
}

export interface ArkanoidScoreEntry {
  userName: string;
  score: number;
  cardsBroken: number;
}

export interface CatRunScoreEntry {
  userName: string;
  score: number;
  level: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userName: string;
  text: string;
  timestamp: number;
}

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
  points: WhiteboardPoint[];
}

export type AuthProfileType = 'fixed' | 'registered' | 'guest';

export type TeamRole = 'admin' | 'user';

export interface TeamMember {
  teamId: string;
  name: string;
  role: TeamRole;
}

export interface TeamRoomSettings {
  template: RetroTemplateId;
  columnTitles: string[];
  columnColors: ColumnColorId[];
  features: RoomFeatures;
}

export const DEFAULT_TEAM_ROOM_SETTINGS: TeamRoomSettings = {
  template: 'classic',
  columnTitles: [...DEFAULT_COLUMN_TITLES],
  columnColors: [...DEFAULT_COLUMN_COLORS],
  features: { ...DEFAULT_ROOM_FEATURES }
};

export interface Team {
  id: string;
  name: string;
  owner: string;
  createdAt?: string;
  members: TeamMember[];
  roomSettings?: TeamRoomSettings;
}

export interface AvailableTeam {
  id: string;
  name: string;
  owner: string;
  membersCount: number;
  createdAt?: string;
}
