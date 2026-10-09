export const DAY = 24 * 60 * 60 * 1000;

// Days start at midnight in Istanbul, three hours ahead of UTC all year.
const ISTANBUL = 3 * 60 * 60 * 1000;

/** The calendar day in Istanbul, as "2026-10-25". */
export const dayOf = (iso: string) => new Date(Date.parse(iso) + ISTANBUL).toISOString().slice(0, 10);

export const startOfDay = (time: number) => Math.floor((time + ISTANBUL) / DAY) * DAY - ISTANBUL;

export const endOfDay = (time: number) => startOfDay(time) + DAY;

/** Where "the last 7 days" before `at` start: today and the six days before it. */
export const weekStart = (at: number) => startOfDay(at - 1) - 6 * DAY;
