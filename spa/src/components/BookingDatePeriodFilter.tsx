import { CHECK_IN_AUDIT_MONTHS } from "@/utils/lib/checkInAudit";
import {
  clearBookingListDateFilter,
  DateFilterMode,
  Filter,
  hasInvalidBookingListDateFilter,
} from "@/utils/lib/bookingListFilters";

interface BookingDatePeriodFilterProps {
  filterState: Filter;
  setFilterState: React.Dispatch<React.SetStateAction<Filter>>;
}

export default function BookingDatePeriodFilter({
  filterState,
  setFilterState,
}: BookingDatePeriodFilterProps) {
  const mode = filterState.dateMode ?? "range";
  const currentYear = new Date().getFullYear();

  const setMode = (nextMode: DateFilterMode) => {
    setFilterState((current) => ({
      ...clearBookingListDateFilter(current),
      dateMode: nextMode,
      dateMonth:
        nextMode === "month" ? new Date().getMonth() + 1 : null,
      dateYear: nextMode === "month" ? currentYear : null,
    }));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#D0D0D0] p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-bold">Date period</label>
        <button
          className="text-sm font-bold text-selectedButton"
          onClick={() =>
            setFilterState((current) => clearBookingListDateFilter(current))
          }
          type="button"
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["range", "month"] as const).map((option) => (
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${
              mode === option
                ? "border-selectedButton bg-primaryShade text-selectedButton"
                : "border-[#BEBEBE]"
            }`}
            key={option}
            onClick={() => setMode(option)}
            type="button"
          >
            {option === "range" ? "Date range" : "Month & year"}
          </button>
        ))}
      </div>
      {mode === "range" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-typo_light-200">
            From
            <input
              className="h-11 min-w-0 rounded-lg border border-[#BEBEBE] px-3 text-sm text-typo_dark-300"
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  dateMode: "range",
                  dateFrom: event.target.value || null,
                }))
              }
              type="date"
              value={filterState.dateFrom ?? ""}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-typo_light-200">
            To
            <input
              className="h-11 min-w-0 rounded-lg border border-[#BEBEBE] px-3 text-sm text-typo_dark-300"
              min={filterState.dateFrom ?? undefined}
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  dateMode: "range",
                  dateTo: event.target.value || null,
                }))
              }
              type="date"
              value={filterState.dateTo ?? ""}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-typo_light-200">
            Month
            <select
              className="h-11 rounded-lg border border-[#BEBEBE] bg-white px-3 text-sm text-typo_dark-300"
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  dateMode: "month",
                  dateMonth: Number(event.target.value),
                }))
              }
              value={filterState.dateMonth ?? new Date().getMonth() + 1}
            >
              {CHECK_IN_AUDIT_MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-typo_light-200">
            Year
            <input
              className="h-11 rounded-lg border border-[#BEBEBE] bg-white px-3 text-sm text-typo_dark-300"
              max={2100}
              min={2000}
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  dateMode: "month",
                  dateYear: Number(event.target.value),
                }))
              }
              type="number"
              value={filterState.dateYear ?? currentYear}
            />
          </label>
        </div>
      )}
      {hasInvalidBookingListDateFilter(filterState) ? (
        <p className="text-xs text-error">
          {mode === "range"
            ? "Choose a valid start and end date."
            : "Choose a month and year."}
        </p>
      ) : null}
    </div>
  );
}
