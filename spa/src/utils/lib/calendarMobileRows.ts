export const MOBILE_CALENDAR_EVENT_LIMIT = 5;

export function splitCalendarEventsForMobile<T extends { order: number }>(
  events: T[],
  limit = MOBILE_CALENDAR_EVENT_LIMIT
): { visibleEvents: T[]; hiddenCount: number } {
  const visibleEvents = events.filter((event) => event.order <= limit);

  return {
    visibleEvents,
    hiddenCount: Math.max(0, events.length - visibleEvents.length),
  };
}
