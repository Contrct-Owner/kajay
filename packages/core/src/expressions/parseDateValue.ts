const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/u;
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Parses a Kajay instant or exact v2 date text without host date-parser extensions. */
export function parseDateValue(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly !== null) {
    return createDate(dateParts(dateOnly), 0, 0, 0, 0, 0);
  }

  const dateTime = DATE_TIME.exec(value);
  if (dateTime === null) {
    return undefined;
  }
  const hour = Number(dateTime[4]);
  const minute = Number(dateTime[5]);
  const second = Number(dateTime[6]);
  const millisecond = Number((dateTime[7] ?? '').padEnd(3, '0'));
  const offset = readOffset(dateTime[8] ?? '');
  if (hour > 23 || minute > 59 || second > 59 || offset === undefined) {
    return undefined;
  }
  return createDate(dateParts(dateTime), hour, minute, second, millisecond, offset);
}

function dateParts(match: RegExpExecArray): readonly [number, number, number] {
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function createDate(
  [year, month, day]: readonly [number, number, number],
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  offsetMinutes: number,
): Date | undefined {
  if (!isCalendarDate(year, month, day)) {
    return undefined;
  }
  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, millisecond);
  const instant = new Date(local.getTime() - offsetMinutes * 60_000);
  return Number.isFinite(instant.getTime()) ? instant : undefined;
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximum = month === 2 && leap ? 29 : (DAYS_PER_MONTH[month - 1] ?? 0);
  return day <= maximum;
}

function readOffset(text: string): number | undefined {
  if (text === 'Z') {
    return 0;
  }
  const hours = Number(text.slice(1, 3));
  const minutes = Number(text.slice(4, 6));
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) {
    return undefined;
  }
  const total = hours * 60 + minutes;
  return text[0] === '-' ? -total : total;
}
