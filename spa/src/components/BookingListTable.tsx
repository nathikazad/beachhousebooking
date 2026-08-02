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
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd MMM");
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

function amount(value: number | undefined): string {
  return `Rs ${(value ?? 0).toLocaleString("en-IN")}`;
}

function compactAmount(value: number | undefined): string {
  return `₹${(value ?? 0).toLocaleString("en-IN")}`;
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
    <div className="my-4 w-full overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full table-auto text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-px whitespace-nowrap px-2 py-3 desktop-up:px-3">
              {isLog ? "Created" : "Check-in"}
            </th>
            <th className="w-full px-2 py-3 desktop-up:px-3">Name</th>
            <th className="w-px whitespace-nowrap px-2 py-3 desktop-up:px-3">
              <span className="desktop-up:hidden" aria-label="Property">P</span>
              <span className="hidden desktop-up:inline">Property</span>
            </th>
            <th className="w-px whitespace-nowrap px-2 py-3 desktop-up:px-3">
              <span className="desktop-up:hidden" aria-label="Status">S</span>
              <span className="hidden desktop-up:inline">Status</span>
            </th>
            {isLog ? (
              <>
                <th className="hidden w-28 px-3 py-3 tablet-up:table-cell">
                  Created by
                </th>
                <th className="hidden w-20 px-3 py-3 laptop-up:table-cell">
                  Type
                </th>
                <th className="hidden w-24 px-3 py-3 xl:table-cell">
                  Payment
                </th>
                <th className="w-px whitespace-nowrap px-2 py-3 desktop-up:px-3">
                  <span className="desktop-up:hidden">Due</span>
                  <span className="hidden desktop-up:inline">Outstanding</span>
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
                <th className="hidden w-24 px-3 py-3 tablet-up:table-cell">
                  Payment
                </th>
                <th className="hidden w-20 px-3 py-3 laptop-up:table-cell">
                  Type
                </th>
                <th className="w-px whitespace-nowrap px-2 py-3 desktop-up:px-3">
                  <span className="desktop-up:hidden">Due</span>
                  <span className="hidden desktop-up:inline">Outstanding</span>
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
            <th className="w-10 px-2 py-3" aria-label="Open booking" />
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
              <td className="whitespace-nowrap px-2 py-3 text-slate-600 desktop-up:px-3">
                <span className="desktop-up:hidden">
                  {formatCompactTableDate(
                    isLog ? booking.createdDateTime : booking.startDateTime
                  )}
                </span>
                <span className="hidden desktop-up:inline">
                  {formatDate(
                    isLog ? booking.createdDateTime : booking.startDateTime
                  )}
                </span>
              </td>
              <td
                className="max-w-0 px-2 py-3 font-medium text-neutral-900 desktop-up:px-3"
                title={booking.client.name}
              >
                <div className="flex min-w-0 items-center">
                  <span className="min-w-0 truncate desktop-up:hidden">
                    {firstTableName(booking.client.name)}
                  </span>
                  <span className="hidden min-w-0 truncate desktop-up:inline">
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
                className="w-px whitespace-nowrap px-2 py-3 text-slate-600 desktop-up:px-3"
                title={booking.properties?.join(", ") || undefined}
              >
                <span className="desktop-up:hidden">
                  {abbreviateTableProperties(booking.properties)}
                </span>
                <span className="hidden desktop-up:inline">
                  {booking.properties?.join(", ") || "—"}
                </span>
              </td>
              <td
                className="w-px whitespace-nowrap px-2 py-3 text-slate-600 desktop-up:px-3"
                title={booking.status}
              >
                <span className="desktop-up:hidden">
                  {abbreviateBookingStatus(booking.status)}
                </span>
                <span className="hidden desktop-up:inline">{booking.status}</span>
              </td>
              {isLog ? (
                <>
                  <td className="hidden truncate px-3 py-3 text-slate-600 tablet-up:table-cell">
                    {booking.createdBy?.name || "—"}
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 laptop-up:table-cell">
                    {booking.bookingType}
                  </td>
                  <td className="hidden px-3 py-3 xl:table-cell">
                    {(booking.outstanding ?? 0) === 0 ? "Paid" : "Unpaid"}
                  </td>
                  <td className="w-px whitespace-nowrap px-2 py-3 text-slate-600 desktop-up:px-3">
                    <span className="desktop-up:hidden">
                      {compactAmount(booking.outstanding)}
                    </span>
                    <span className="hidden desktop-up:inline">
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
                  <td className="hidden px-3 py-3 tablet-up:table-cell">
                    {(booking.outstanding ?? 0) === 0 ? "Paid" : "Unpaid"}
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 laptop-up:table-cell">
                    {booking.bookingType}
                  </td>
                  <td className="w-px whitespace-nowrap px-2 py-3 text-slate-600 desktop-up:px-3">
                    <span className="desktop-up:hidden">
                      {compactAmount(booking.outstanding)}
                    </span>
                    <span className="hidden desktop-up:inline">
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
              <td className="px-2 py-3 text-right">
                <span className="material-symbols-outlined text-xl text-slate-500">
                  chevron_right
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
