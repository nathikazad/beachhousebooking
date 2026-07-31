export interface CalendarEventSegment {
  startsHere: boolean;
  endsHere: boolean;
  startPercent: number;
  endPercent: number;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function nextDay(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
}

function sameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function percentThroughDay(value: Date, dayStart: Date, dayEnd: Date): number {
  const percent =
    ((value.getTime() - dayStart.getTime()) /
      (dayEnd.getTime() - dayStart.getTime())) *
    100;
  return Math.min(100, Math.max(0, percent));
}

export function calendarEventSegment(
  calendarDate: Date,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEventSegment | null {
  if (
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime()) ||
    rangeEnd <= rangeStart
  ) {
    return null;
  }

  const dayStart = startOfDay(calendarDate);
  const dayEnd = nextDay(calendarDate);
  if (rangeStart >= dayEnd || rangeEnd <= dayStart) return null;

  const startsHere = sameDay(rangeStart, dayStart);
  const endsHere = sameDay(rangeEnd, dayStart);

  return {
    startsHere,
    endsHere,
    startPercent: startsHere
      ? percentThroughDay(rangeStart, dayStart, dayEnd)
      : 0,
    endPercent: endsHere
      ? percentThroughDay(rangeEnd, dayStart, dayEnd)
      : 100,
  };
}
