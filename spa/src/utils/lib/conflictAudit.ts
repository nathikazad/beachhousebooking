import {
  BookingOccupancyStatus,
  displayProperty,
  formatInIndianTime,
} from "./occupancy";

export interface AuditedBookingPeriod {
  bookingId: number;
  clientName: string;
  status: BookingOccupancyStatus;
  eventKey: string;
  eventName: string;
  startsAt: string;
  endsAt: string;
}

export interface AuditedBookingConflict {
  firstBooking: AuditedBookingPeriod;
  secondBooking: AuditedBookingPeriod;
  property: string;
  overlapStartsAt: string;
  overlapEndsAt: string;
}

export interface AuditedBookingSummary {
  bookingId: number;
  clientName: string;
  status: BookingOccupancyStatus;
  periods: AuditedBookingPeriod[];
}

export interface BookingConflictGroup {
  id: string;
  property: string;
  overlapStartsAt: string;
  overlapEndsAt: string;
  bookings: AuditedBookingSummary[];
  conflicts: AuditedBookingConflict[];
  message: string;
}

export interface DoubleBookingAuditResponse {
  generatedAt: string;
  conflictPeriodCount: number;
  conflictGroupCount: number;
  groups: BookingConflictGroup[];
}

function periodIdentity(booking: AuditedBookingPeriod): string {
  return `${booking.bookingId}:${booking.eventKey}`;
}

function formatBookingLabel(
  booking: Pick<AuditedBookingPeriod, "bookingId" | "clientName">
): string {
  return `booking #${booking.bookingId} (${booking.clientName})`;
}

function formatBookingPeriodLabel(booking: AuditedBookingPeriod): string {
  const event =
    booking.eventName && booking.eventName !== "Stay"
      ? `, ${booking.eventName}`
      : "";

  return `booking #${booking.bookingId} (${booking.clientName}${event})`;
}

function formatGroupMessage(
  property: string,
  startsAt: string,
  endsAt: string,
  bookings: AuditedBookingSummary[]
): string {
  const period = `${formatInIndianTime(startsAt)} to ${formatInIndianTime(endsAt)}`;
  const propertyName = displayProperty(property);

  if (bookings.length === 2) {
    return `${formatBookingLabel(bookings[0])} and ${formatBookingLabel(
      bookings[1]
    )} have overlapping periods at ${propertyName} between ${period}.`;
  }

  return `${bookings.length} reservations are involved in connected overlaps at ${propertyName} between ${period}. Review the exact pairwise periods below.`;
}

function finishGroup(
  property: string,
  startsAt: string,
  endsAt: string,
  conflicts: AuditedBookingConflict[]
): BookingConflictGroup {
  const bookingsById = new Map<number, AuditedBookingSummary>();

  for (const conflict of conflicts) {
    for (const booking of [conflict.firstBooking, conflict.secondBooking]) {
      const existing = bookingsById.get(booking.bookingId);

      if (!existing) {
        bookingsById.set(booking.bookingId, {
          bookingId: booking.bookingId,
          clientName: booking.clientName,
          status: booking.status,
          periods: [booking],
        });
        continue;
      }

      if (
        !existing.periods.some(
          (period) => periodIdentity(period) === periodIdentity(booking)
        )
      ) {
        existing.periods.push(booking);
      }
    }
  }

  const bookings = Array.from(bookingsById.values())
    .map((booking) => ({
      ...booking,
      periods: booking.periods.sort((first, second) =>
        first.startsAt.localeCompare(second.startsAt)
      ),
    }))
    .sort((first, second) => first.bookingId - second.bookingId);

  return {
    id: `${property}:${startsAt}:${endsAt}:${bookings
      .map((booking) => booking.bookingId)
      .join(",")}`,
    property,
    overlapStartsAt: startsAt,
    overlapEndsAt: endsAt,
    bookings,
    conflicts,
    message: formatGroupMessage(property, startsAt, endsAt, bookings),
  };
}

export function groupBookingConflicts(
  conflicts: AuditedBookingConflict[]
): BookingConflictGroup[] {
  const sorted = [...conflicts].sort(
    (first, second) =>
      first.property.localeCompare(second.property) ||
      first.overlapStartsAt.localeCompare(second.overlapStartsAt) ||
      first.overlapEndsAt.localeCompare(second.overlapEndsAt)
  );
  const groups: BookingConflictGroup[] = [];

  let property = "";
  let startsAt = "";
  let endsAt = "";
  let groupedConflicts: AuditedBookingConflict[] = [];

  const flush = () => {
    if (groupedConflicts.length === 0) {
      return;
    }

    groups.push(finishGroup(property, startsAt, endsAt, groupedConflicts));
    groupedConflicts = [];
  };

  for (const conflict of sorted) {
    const sameProperty = conflict.property === property;
    const connectedPeriod =
      sameProperty &&
      new Date(conflict.overlapStartsAt).getTime() <
        new Date(endsAt).getTime();

    if (groupedConflicts.length === 0 || !connectedPeriod) {
      flush();
      property = conflict.property;
      startsAt = conflict.overlapStartsAt;
      endsAt = conflict.overlapEndsAt;
      groupedConflicts = [conflict];
      continue;
    }

    groupedConflicts.push(conflict);
    if (
      new Date(conflict.overlapEndsAt).getTime() > new Date(endsAt).getTime()
    ) {
      endsAt = conflict.overlapEndsAt;
    }
  }

  flush();

  return groups.sort(
    (first, second) =>
      first.overlapStartsAt.localeCompare(second.overlapStartsAt) ||
      first.property.localeCompare(second.property)
  );
}

export function formatPairConflictMessage(
  conflict: AuditedBookingConflict
): string {
  return `${formatBookingPeriodLabel(
    conflict.firstBooking
  )} and ${formatBookingPeriodLabel(
    conflict.secondBooking
  )} overlap from ${formatInIndianTime(
    conflict.overlapStartsAt
  )} to ${formatInIndianTime(conflict.overlapEndsAt)}.`;
}
