export const MOBILE_CALENDAR_EVENT_LIMIT = 3;

export function splitCalendarEventsForMobile<T>(
  events: T[],
  limit = MOBILE_CALENDAR_EVENT_LIMIT
): { visibleEvents: T[]; hiddenCount: number } {
  const visibleEvents = events.slice(0, limit);

  return {
    visibleEvents,
    hiddenCount: Math.max(0, events.length - visibleEvents.length),
  };
}
