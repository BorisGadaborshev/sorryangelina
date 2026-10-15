export const SPRINTS_PER_SUPER_SPRINT = 6;
export const SUPER_SPRINTS_PER_YEAR = 6;

const SPRINT_REF = /^(\d{4})\.(\d+)\.(\d+)$/;
const LEGACY_SPRINT_REF = /^(\d{4}) · СС(\d+) · Спринт (\d+)$/;

export interface SprintRef {
  year: number;
  superSprint: number;
  sprint: number;
}

export const formatSprintRef = ({ year, superSprint, sprint }: SprintRef): string =>
  `${year}.${superSprint}.${sprint}`;

const toSprintRef = (year: number, superSprint: number, sprint: number): SprintRef | null => {
  if (
    !Number.isInteger(year)
    || superSprint < 1
    || superSprint > SUPER_SPRINTS_PER_YEAR
    || sprint < 1
    || sprint > SPRINTS_PER_SUPER_SPRINT
  ) {
    return null;
  }
  return { year, superSprint, sprint };
};

export const parseSprintRef = (value?: string): SprintRef | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(SPRINT_REF) ?? trimmed.match(LEGACY_SPRINT_REF);
  if (!match) return null;
  return toSprintRef(Number(match[1]), Number(match[2]), Number(match[3]));
};

export const sprintYearOptions = (now = new Date()): number[] => {
  const current = now.getFullYear();
  return [current - 1, current, current + 1];
};

export const sprintOptions = (now = new Date(), extra?: string): string[] => {
  const values = sprintYearOptions(now).flatMap((year) =>
    Array.from({ length: SUPER_SPRINTS_PER_YEAR }, (_, superIndex) =>
      Array.from({ length: SPRINTS_PER_SUPER_SPRINT }, (_, sprintIndex) =>
        formatSprintRef({
          year,
          superSprint: superIndex + 1,
          sprint: sprintIndex + 1
        })
      )
    ).flat()
  );
  const normalizedExtra = parseSprintRef(extra);
  if (normalizedExtra) {
    const formatted = formatSprintRef(normalizedExtra);
    if (!values.includes(formatted)) values.unshift(formatted);
  } else if (extra?.trim()) {
    values.unshift(extra.trim());
  }
  return values;
};
