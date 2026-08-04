import format from "date-fns/format";
import { BookingDB, numOfDays, Property } from "../utils/lib/bookingType";

interface BookingListTableProps {
  bookings: BookingDB[];
  list: "bookings" | "logs";
  onSelect: (bookingId: number | undefined) => void;
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd MMM yy");
}

export function formatCompactTableDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd/MM");
}

export function firstTableName(value: string | undefined): string {
  const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  const titles = new Set([
    "mr",
    "mrs",
    "ms",
    "miss",
    "dr",
    "prof",
    "shri",
    "sri",
    "smt",
  ]);
  const firstNonTitle = words.find(
    (word) => !titles.has(word.replace(/\.+$/, "").toLowerCase())
  );
  return firstNonTitle || words[0] || "—";
}

const propertyAbbreviations: Record<Property, string> = {
  [Property.Bluehouse]: "BH",
  [Property.Glasshouse]: "GH",
  [Property.Castle]: "C",
  [Property.MeadowLane]: "ML",
  [Property.LeChalet]: "LC",
  [Property.VillaArmati]: "VA",
};

export function abbreviateTableProperties(
  properties: Property[] | undefined
): string {
  return (
    properties?.map((property) => propertyAbbreviations[property]).join(", ") ||
    "—"
  );
}

export function abbreviateBookingStatus(status: BookingDB["status"]): string {
  const abbreviations: Record<BookingDB["status"], string> = {
    Inquiry: "I",
    Quotation: "Q",
    Preconfirmed: "P",
    Confirmed: "C",
  };
  return abbreviations[status] ?? status?.charAt(0).toUpperCase() ?? "—";
}

export function abbreviatePaymentStatus(
  outstanding: number | undefined
): "P" | "U" {
  return (outstanding ?? 0) === 0 ? "P" : "U";
}

function amount(value: number | undefined): string {
  return `Rs ${(value ?? 0).toLocaleString("en-IN")}`;
}

export function formatCompactTableAmount(value: number | undefined): string {
  const numericValue = Number.isFinite(value) ? (value as number) : 0;
  const absoluteValue = Math.abs(numericValue);

  if (absoluteValue >= 100_000) {
    return `₹${(numericValue / 100_000).toLocaleString("en-IN", {
      maximumFractionDigits: 1,
    })}L`;
  }

  if (absoluteValue >= 1_000) {
    return `₹${(numericValue / 1_000).toLocaleString("en-IN", {
      maximumFractionDigits: 1,
    })}K`;
  }

  return `₹${numericValue.toLocaleString("en-IN")}`;
}

export function sortBookingsForTable(
  bookings: BookingDB[],
  list: "bookings" | "logs"
): BookingDB[] {
  const dateField = list === "logs" ? "createdDateTime" : "startDateTime";
  const direction = list === "logs" ? -1 : 1;
  return [...bookings].sort((first, second) => {
    const firstTime = new Date(first[dateField]).getTime();
    const secondTime = new Date(second[dateField]).getTime();
    if (Number.isNaN(firstTime)) return 1;
    if (Number.isNaN(secondTime)) return -1;
    return (firstTime - secondTime) * direction;
  });
}

export default function BookingListTable({
  bookings,
  list,
  onSelect,
}: BookingListTableProps) {
  const isLog = list === "logs";
  const displayedBookings = sortBookingsForTable(bookings, list);

  return (
    <div className="-mx-6 my-4 w-[calc(100%+3rem)] overflow-x-auto rounded-xl border border-gray-200 tablet-up:mx-0 tablet-up:w-full">
      <table className="w-full table-auto text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-px whitespace-nowrap py-3 pl-3 pr-2 table-wide-up:px-3">
              {isLog ? "Created" : "Check-in"}
            </th>
            <th className="w-full px-2 py-3 table-wide-up:px-3">Name</th>
            <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">
              Prop.
            </th>
            <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">
              <span className="table-wide-up:hidden" aria-label="Status">S</span>
              <span className="hidden table-wide-up:inline">Status</span>
            </th>
            {isLog ? (
              <>
                <th className="hidden w-28 px-3 py-3 tablet-up:table-cell">
                  Created by
                </th>
                <th className="hidden w-20 px-3 py-3 laptop-up:table-cell">
                  Type
                </th>
                <th className="hidden w-px whitespace-nowrap px-2 py-3 table-payment-up:table-cell xl:w-24 xl:px-3">
                  <span className="xl:hidden" aria-label="Payment">P</span>
                  <span className="hidden xl:inline">Payment</span>
                </th>
                <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">
                  <span className="table-wide-up:hidden">Due</span>
                  <span className="hidden table-wide-up:inline">Outstanding</span>
                </th>
                <th className="hidden w-20 px-3 py-3 2xl:table-cell">
                  Guests
                </th>
                <th className="hidden w-28 px-3 py-3 2xl:table-cell">
                  Referral
                </th>
              </>
            ) : (
              <>
                <th className="hidden w-px whitespace-nowrap px-2 py-3 table-payment-up:table-cell tablet-up:w-24 tablet-up:px-3">
                  <span className="tablet-up:hidden" aria-label="Payment">P</span>
                  <span className="hidden tablet-up:inline">Payment</span>
                </th>
                <th className="hidden w-20 px-3 py-3 laptop-up:table-cell">
                  Type
                </th>
                <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">
                  <span className="table-wide-up:hidden">Due</span>
                  <span className="hidden table-wide-up:inline">Outstanding</span>
                </th>
                <th className="hidden w-20 px-3 py-3 desktop-up:table-cell">
                  Guests
                </th>
                <th className="hidden w-20 px-3 py-3 2xl:table-cell">
                  Duration
                </th>
                <th className="hidden w-28 px-3 py-3 2xl:table-cell">
                  Referral
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {displayedBookings.map((booking) => (
            <tr
              key={booking.bookingId}
              id={`${booking.bookingId}-id`}
              tabIndex={0}
              onClick={() => onSelect(booking.bookingId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(booking.bookingId);
                }
              }}
              className="cursor-pointer bg-white hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
            >
              <td className="whitespace-nowrap py-3 pl-3 pr-2 text-slate-600 table-wide-up:px-3">
                <span className="table-wide-up:hidden">
                  {formatCompactTableDate(
                    isLog ? booking.createdDateTime : booking.startDateTime
                  )}
                </span>
                <span className="hidden table-wide-up:inline">
                  {formatDate(
                    isLog ? booking.createdDateTime : booking.startDateTime
                  )}
                </span>
              </td>
              <td
                className="min-w-[12ch] px-2 py-3 font-medium text-neutral-900 table-wide-up:px-3"
                title={booking.client.name}
              >
                <div className="flex min-w-0 items-center">
                  <span className="min-w-0 truncate table-wide-up:hidden">
                    {firstTableName(booking.client.name)}
                  </span>
                  <span className="hidden min-w-0 truncate table-wide-up:inline">
                    {booking.client.name}
                  </span>
                  {booking.starred ? (
                    <span className="material-symbols-filled ml-1 shrink-0 text-base">
                      star_rate
                    </span>
                  ) : null}
                </div>
              </td>
              <td
                className="w-px whitespace-nowrap px-2 py-3 text-slate-600 table-wide-up:px-3"
                title={booking.properties?.join(", ") || undefined}
              >
                <span className="table-wide-up:hidden">
                  {abbreviateTableProperties(booking.properties)}
                </span>
                <span className="hidden table-wide-up:inline">
                  {booking.properties?.join(", ") || "—"}
                </span>
              </td>
              <td
                className="w-px whitespace-nowrap px-2 py-3 text-slate-600 table-wide-up:px-3"
                title={booking.status}
              >
                <span className="table-wide-up:hidden">
                  {abbreviateBookingStatus(booking.status)}
                </span>
                <span className="hidden table-wide-up:inline">{booking.status}</span>
              </td>
              {isLog ? (
                <>
                  <td className="hidden truncate px-3 py-3 text-slate-600 tablet-up:table-cell">
                    {booking.createdBy?.name || "—"}
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 laptop-up:table-cell">
                    {booking.bookingType}
                  </td>
                  <td className="hidden w-px whitespace-nowrap px-2 py-3 table-payment-up:table-cell xl:px-3">
                    <span className="xl:hidden">
                      {abbreviatePaymentStatus(booking.outstanding)}
                    </span>
                    <span className="hidden xl:inline">
                      {(booking.outstanding ?? 0) === 0 ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td
                    className="w-px whitespace-nowrap px-2 py-3 text-slate-600 table-wide-up:px-3"
                    title={amount(booking.outstanding)}
                  >
                    <span className="table-wide-up:hidden">
                      {formatCompactTableAmount(booking.outstanding)}
                    </span>
                    <span className="hidden table-wide-up:inline">
                      {amount(booking.outstanding)}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 2xl:table-cell">
                    {booking.numberOfGuests}
                  </td>
                  <td className="hidden truncate px-3 py-3 text-slate-600 2xl:table-cell">
                    {booking.refferral || "—"}
                  </td>
                </>
              ) : (
                <>
                  <td className="hidden w-px whitespace-nowrap px-2 py-3 table-payment-up:table-cell tablet-up:px-3">
                    <span className="tablet-up:hidden">
                      {abbreviatePaymentStatus(booking.outstanding)}
                    </span>
                    <span className="hidden tablet-up:inline">
                      {(booking.outstanding ?? 0) === 0 ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 laptop-up:table-cell">
                    {booking.bookingType}
                  </td>
                  <td
                    className="w-px whitespace-nowrap px-2 py-3 text-slate-600 table-wide-up:px-3"
                    title={amount(booking.outstanding)}
                  >
                    <span className="table-wide-up:hidden">
                      {formatCompactTableAmount(booking.outstanding)}
                    </span>
                    <span className="hidden table-wide-up:inline">
                      {amount(booking.outstanding)}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 desktop-up:table-cell">
                    {booking.numberOfGuests}
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 2xl:table-cell">
                    {numOfDays(booking)} days
                  </td>
                  <td className="hidden truncate px-3 py-3 text-slate-600 2xl:table-cell">
                    {booking.refferral || "—"}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
