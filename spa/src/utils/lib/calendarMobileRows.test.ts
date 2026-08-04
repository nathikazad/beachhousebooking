import { describe, expect, it } from "vitest";
import {
  MOBILE_CALENDAR_EVENT_LIMIT,
  splitCalendarEventsForMobile,
} from "./calendarMobileRows";

describe("splitCalendarEventsForMobile", () => {
  it("shows every event when the day is within the mobile limit", () => {
    const events = [{ order: 1 }, { order: 2 }];

    expect(splitCalendarEventsForMobile(events)).toEqual({
      visibleEvents: events,
      hiddenCount: 0,
    });
  });

  it("preserves lanes and hides only events beyond the fifth lane", () => {
    const events = [
      { name: "A", order: 1 },
      { name: "B", order: 3 },
      { name: "C", order: 5 },
      { name: "D", order: 6 },
      { name: "E", order: 7 },
    ];

    expect(splitCalendarEventsForMobile(events)).toEqual({
      visibleEvents: events.slice(0, 3),
      hiddenCount: 2,
    });
    expect(MOBILE_CALENDAR_EVENT_LIMIT).toBe(5);
  });
});
