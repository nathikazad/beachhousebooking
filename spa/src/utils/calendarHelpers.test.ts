import { describe, expect, it } from "vitest";

import {
  getEventsFromBooking,
  PRECONFIRMED_CALENDAR_COLOR,
} from "./calendarHelpers";
import { BookingDB, Event, Property } from "./lib/bookingType";

function event(name: string, property: Property): Event {
  return {
    eventName: name,
    startDateTime: "2026-08-10T06:30:00.000Z",
    endDateTime: "2026-08-10T12:30:00.000Z",
    properties: [property],
  } as Event;
}

describe("calendar property filtering", () => {
  it("filters the complete monthly booking set locally by event property", () => {
    const booking = {
      bookingId: 42,
      bookingType: "Event",
      client: { name: "Client", phone: "" },
      events: [
        event("Blue event", Property.Bluehouse),
        event("Castle event", Property.Castle),
      ],
    } as BookingDB;

    const result = getEventsFromBooking([booking], Property.Castle);

    expect(result).toHaveLength(1);
    expect(result[0].propertyName).toBe("castle");
  });

  it("shows preconfirmed bookings in yellow", () => {
    const booking = {
      bookingId: 43,
      bookingType: "Event",
      status: "Preconfirmed",
      client: { name: "Client", phone: "" },
      events: [event("Provisional event", Property.Bluehouse)],
    } as BookingDB;

    const result = getEventsFromBooking([booking], "all");

    expect(result).toHaveLength(1);
    expect(result[0].color).toBe(PRECONFIRMED_CALENDAR_COLOR);
  });
});
