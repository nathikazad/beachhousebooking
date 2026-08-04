import { describe, expect, it } from "vitest";
import {
  MOBILE_CALENDAR_EVENT_LIMIT,
  splitCalendarEventsForMobile,
} from "./calendarMobileRows";

describe("splitCalendarEventsForMobile", () => {
  it("shows every event when the day is within the mobile limit", () => {
    expect(splitCalendarEventsForMobile(["A", "B"])).toEqual({
      visibleEvents: ["A", "B"],
      hiddenCount: 0,
    });
  });

  it("caps busy days and reports the events hidden behind the ellipsis", () => {
    expect(
      splitCalendarEventsForMobile(["A", "B", "C", "D", "E"])
    ).toEqual({
      visibleEvents: ["A", "B", "C"],
      hiddenCount: 2,
    });
    expect(MOBILE_CALENDAR_EVENT_LIMIT).toBe(3);
  });
});
