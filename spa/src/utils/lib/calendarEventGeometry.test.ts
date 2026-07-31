import { describe, expect, it } from "vitest";
import { calendarEventSegment } from "./calendarEventGeometry";

describe("calendarEventSegment", () => {
  const day = new Date(2026, 6, 31);

  it("starts a noon check-in halfway through its day cell", () => {
    const segment = calendarEventSegment(
      day,
      new Date(2026, 6, 31, 12),
      new Date(2026, 7, 2, 10)
    );

    expect(segment).toEqual({
      startsHere: true,
      endsHere: false,
      startPercent: 50,
      endPercent: 100,
    });
  });

  it("ends a 6 PM check-out three quarters through its day cell", () => {
    const segment = calendarEventSegment(
      day,
      new Date(2026, 6, 29, 12),
      new Date(2026, 6, 31, 18)
    );

    expect(segment).toEqual({
      startsHere: false,
      endsHere: true,
      startPercent: 0,
      endPercent: 75,
    });
  });

  it("uses both times for an event contained within one day", () => {
    const segment = calendarEventSegment(
      day,
      new Date(2026, 6, 31, 9),
      new Date(2026, 6, 31, 15)
    );

    expect(segment?.startPercent).toBe(37.5);
    expect(segment?.endPercent).toBe(62.5);
    expect(segment?.startsHere).toBe(true);
    expect(segment?.endsHere).toBe(true);
  });

  it("fills intervening days and excludes a midnight checkout day", () => {
    const start = new Date(2026, 6, 30, 12);
    const end = new Date(2026, 7, 1, 0);

    expect(calendarEventSegment(day, start, end)).toEqual({
      startsHere: false,
      endsHere: false,
      startPercent: 0,
      endPercent: 100,
    });
    expect(calendarEventSegment(new Date(2026, 7, 1), start, end)).toBeNull();
  });

  it("rejects invalid or reversed ranges", () => {
    expect(
      calendarEventSegment(day, new Date("invalid"), new Date())
    ).toBeNull();
    expect(
      calendarEventSegment(
        day,
        new Date(2026, 6, 31, 12),
        new Date(2026, 6, 31, 10)
      )
    ).toBeNull();
  });
});
