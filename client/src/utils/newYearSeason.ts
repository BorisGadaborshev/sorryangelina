/** Inclusive window: 1 December through 15 January. */
export const isNewYearSeason = (date: Date = new Date()): boolean => {
  const month = date.getMonth();
  const day = date.getDate();
  return month === 11 || (month === 0 && day <= 15);
};
