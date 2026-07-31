import format from "date-fns/format";
import { BookingDB, numOfDays } from "../utils/lib/bookingType";

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

function amount(value: number | undefined): string {
  return `Rs ${(value ?? 0).toLocaleString("en-IN")}`;
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
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-24 px-3 py-3">
              {isLog ? "Created" : "Check-in"}
            </th>
            <th className="px-3 py-3">Name</th>
            <th className="w-32 px-3 py-3">Property</th>
            <th className="hidden w-24 px-3 py-3 mobile-up:table-cell">
              Status
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
                <th className="hidden w-28 px-3 py-3 desktop-up:table-cell">
                  Outstanding
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
                <th className="hidden w-28 px-3 py-3 xl:table-cell">
                  Outstanding
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
              <td className="truncate px-3 py-3 text-slate-600">
                {formatDate(
                  isLog ? booking.createdDateTime : booking.startDateTime
                )}
              </td>
              <td className="truncate px-3 py-3 font-medium text-neutral-900">
                {booking.client.name}
                {booking.starred ? (
                  <span className="material-symbols-filled ml-1 align-middle text-base">
                    star_rate
                  </span>
                ) : null}
              </td>
              <td className="truncate px-3 py-3 text-slate-600">
                {booking.properties?.join(", ") || "—"}
              </td>
              <td className="hidden truncate px-3 py-3 text-slate-600 mobile-up:table-cell">
                {booking.status}
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
                  <td className="hidden px-3 py-3 text-slate-600 desktop-up:table-cell">
                    {amount(booking.outstanding)}
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
                  <td className="hidden px-3 py-3 text-slate-600 xl:table-cell">
                    {amount(booking.outstanding)}
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
