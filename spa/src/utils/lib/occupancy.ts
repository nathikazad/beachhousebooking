import { BookingForm, Property, convertPropertiesForDb } from "./bookingType";

export const blockingStatuses = ["confirmed", "preconfirmed"] as const;

export type BookingOccupancyStatus =
  | "inquiry"
  | "quotation"
  | "confirmed"
  | "cancelled"
  | "preconfirmed";

export interface BookingOccupancyInput {
  eventKey: string;
  eventName: string;
  property: string;
  startsAt: string;
  endsAt: string;
  status: BookingOccupancyStatus;
}

export interface BookingConflict {
  bookingId: number;
  clientName: string;
  status: BookingOccupancyStatus;
  eventKey: string;
  eventName: string;
  property: string;
  existingStartsAt: string;
  existingEndsAt: string;
  overlapStartsAt: string;
  overlapEndsAt: string;
}

export class OccupancyNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OccupancyNormalizationError";
  }
}

function normalizeStatus(status: BookingForm["status"]): BookingOccupancyStatus {
  return status.toLocaleLowerCase() as BookingOccupancyStatus;
}

function normalizePeriod(
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  label: string
): { startsAt: string; endsAt: string } {
  if (!startDateTime || !endDateTime) {
    throw new OccupancyNormalizationError(`${label} is missing its start or end time.`);
  }

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new OccupancyNormalizationError(`${label} contains an invalid date.`);
  }

  if (start.getTime() >= end.getTime()) {
    throw new OccupancyNormalizationError(`${label} must end after it starts.`);
  }

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

function normalizeProperties(properties: Property[]): string[] {
  return Array.from(new Set(convertPropertiesForDb(properties)));
}

export function isBlockingStatus(status: BookingForm["status"]): boolean {
  return blockingStatuses.includes(
    normalizeStatus(status) as (typeof blockingStatuses)[number]
  );
}

export function normalizeBookingToOccupancies(
  booking: BookingForm
): BookingOccupancyInput[] {
  const status = normalizeStatus(booking.status);

  if (!blockingStatuses.includes(status as (typeof blockingStatuses)[number])) {
    return [];
  }

  if (booking.bookingType === "Stay") {
    const period = normalizePeriod(
      booking.startDateTime,
      booking.endDateTime,
      "Stay"
    );

    return normalizeProperties(booking.properties).map((property) => ({
      eventKey: "stay",
      eventName: "Stay",
      property,
      ...period,
      status,
    }));
  }

  return booking.events.flatMap((event, index) => {
    if (event.markForDeletion) {
      return [];
    }

    const eventName = event.eventName.trim() || `Event ${index + 1}`;
    const period = normalizePeriod(
      event.startDateTime,
      event.endDateTime,
      eventName
    );
    const eventKey = event.eventId
      ? `event-${event.eventId}`
      : `event-index-${index}`;

    return normalizeProperties(event.properties).map((property) => ({
      eventKey,
      eventName,
      property,
      ...period,
      status,
    }));
  });
}

export function formatInIndianTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function displayProperty(property: string): string {
  const labels: Record<string, string> = {
    bluehouse: "Bluehouse",
    glasshouse: "Glasshouse",
    meadowlane: "Meadow Lane",
    lechalet: "Le Chalet",
    villaarmati: "Villa Armati",
    castle: "Castle",
  };
  return labels[property] ?? property;
}

export function formatBookingConflictMessage(
  conflicts: BookingConflict[]
): string {
  if (conflicts.length === 0) {
    return "";
  }

  const heading =
    conflicts.length === 1
      ? "This reservation conflicts with an existing reservation:"
      : `This reservation conflicts with ${conflicts.length} existing reservation periods:`;

  const details = conflicts.map((conflict) => {
    const event =
      conflict.eventName && conflict.eventName !== "Stay"
        ? `, ${conflict.eventName}`
        : "";

    return [
      `• ${displayProperty(conflict.property)} — ${conflict.clientName}`,
      `(booking #${conflict.bookingId}${event})`,
      `Overlap: ${formatInIndianTime(conflict.overlapStartsAt)} to`,
      formatInIndianTime(conflict.overlapEndsAt),
    ].join(" ");
  });

  return [heading, ...details].join("\n");
}

export class BookingConflictError extends Error {
  readonly conflicts: BookingConflict[];

  constructor(conflicts: BookingConflict[]) {
    super(formatBookingConflictMessage(conflicts));
    this.name = "BookingConflictError";
    this.conflicts = conflicts;
  }
}
