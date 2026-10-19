import { validationError } from "./errors";

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// A nonsensical DOB (e.g. 0000-01-01) would satisfy every age threshold.
// 1900 is a deliberately conservative lower bound, recorded in DECISIONS.md.
const MIN_PLAUSIBLE_YEAR = 1900;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] ?? 0;
}

export function parseCalendarDate(value: string, field: string): CalendarDate {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw validationError(`${field} must be a real YYYY-MM-DD calendar date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw validationError(`${field} must be a real YYYY-MM-DD calendar date`);
  }

  if (year < MIN_PLAUSIBLE_YEAR) {
    throw validationError(
      `${field} must be a plausible calendar date (year ${MIN_PLAUSIBLE_YEAR} or later)`,
    );
  }

  return { year, month, day };
}

export function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

/**
 * Calendar age at the injected evaluation date. February 29 advances to
 * March 1 in a non-leap year, which falls out of the month/day comparison.
 */
export function calculateAge(dateOfBirth: string, evaluationDate: string): number {
  const birth = parseCalendarDate(dateOfBirth, "dateOfBirth");
  const evaluated = parseCalendarDate(evaluationDate, "evaluationDate");

  if (compareCalendarDates(birth, evaluated) > 0) {
    throw validationError("dateOfBirth cannot be after the evaluation date");
  }

  let age = evaluated.year - birth.year;
  const birthdayHasOccurred =
    evaluated.month > birth.month ||
    (evaluated.month === birth.month && evaluated.day >= birth.day);

  if (!birthdayHasOccurred) {
    age -= 1;
  }

  return age;
}
