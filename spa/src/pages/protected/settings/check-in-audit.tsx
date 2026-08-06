import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  availableCheckInAuditYears,
  CHECK_IN_AUDIT_MONTHS,
  CHECK_IN_AUDIT_TABS,
  CheckInAuditTabId,
  formatCheckInAuditDate,
  formatCheckInAuditMoney,
  getCurrentCheckInAuditPeriod,
  rowsForCheckInAuditPeriod,
  rowsForCheckInAuditTab,
  summarizeCheckInAuditRows,
} from "@/utils/lib/checkInAudit";
import {
  CheckInAuditResponse,
  loadCheckInAuditCached,
  readCheckInAuditCache,
  readPersistentCheckInAuditCache,
} from "@/utils/lib/checkInAuditCache";
import { supabase } from "@/utils/supabase/client";

export default function CheckInAuditPage() {
  const router = useRouter();
  const initialAudit = useRef(readCheckInAuditCache());
  const hasSavedAudit = useRef(initialAudit.current !== null);
  const currentPeriod = useMemo(
    () => getCurrentCheckInAuditPeriod(),
    []
  );
  const [audit, setAudit] = useState<CheckInAuditResponse | null>(
    initialAudit.current
  );
  const [activeTab, setActiveTab] =
    useState<CheckInAuditTabId>("blue-glass");
  const [selectedMonth, setSelectedMonth] = useState(
    currentPeriod.month
  );
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year);
  const [loading, setLoading] = useState(initialAudit.current === null);
  const [error, setError] = useState("");

  const loadAudit = useCallback(async (force = false) => {
    setLoading(true);
    setError("");

    try {
      const data = await loadCheckInAuditCached(async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error(
            "Please sign in again to view the check-in audit."
          );
        }

        const response = await fetch("/api/check-in-audit", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const responseData = await response.json();
        if (!response.ok) {
          throw new Error(
            responseData.message || "Unable to load the check-in audit."
          );
        }
        return responseData;
      }, force);
      setAudit(data);
    } catch (loadError) {
      if (!hasSavedAudit.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the check-in audit."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readPersistentCheckInAuditCache().then((stored) => {
      if (!cancelled && stored && !initialAudit.current) {
        hasSavedAudit.current = true;
        setAudit(stored);
        setError("");
        setLoading(false);
      }
    });
    void loadAudit(true);
    return () => {
      cancelled = true;
    };
  }, [loadAudit]);

  const availableYears = useMemo(
    () =>
      availableCheckInAuditYears(
        audit?.rows ?? [],
        currentPeriod.year
      ),
    [audit, currentPeriod.year]
  );

  const rows = useMemo(() => {
    if (!audit) return [];
    const periodRows = rowsForCheckInAuditPeriod(audit.rows, {
      month: selectedMonth,
      year: selectedYear,
    });
    return rowsForCheckInAuditTab(periodRows, activeTab);
  }, [activeTab, audit, selectedMonth, selectedYear]);
  const totals = useMemo(
    () => summarizeCheckInAuditRows(rows),
    [rows]
  );

  return (
    <div className="flex w-full flex-col gap-5 pb-8 laptop-up:px-10">
      <div className="flex h-[72px] items-center gap-3">
        <button
          aria-label="Back to settings"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          onClick={() => router.push("/protected/settings")}
          type="button"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="flex-1 text-lg font-bold leading-6">
          Check-in audit
        </h1>
        <button
          aria-label="Refresh check-in audit"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#BEBEBE]"
          disabled={loading}
          onClick={() => loadAudit(true)}
          type="button"
        >
          <span
            className={`material-symbols-outlined ${
              loading ? "animate-spin" : ""
            }`}
          >
            refresh
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 laptop-up:flex laptop-up:w-fit">
        <label className="flex flex-col gap-1 text-xs font-bold text-typo_light-200">
          Month
          <select
            className="h-11 rounded-lg border border-[#BEBEBE] bg-white px-3 text-sm text-typo_dark-300 laptop-up:min-w-44"
            onChange={(event) =>
              setSelectedMonth(Number(event.target.value))
            }
            value={selectedMonth}
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
          <select
            className="h-11 rounded-lg border border-[#BEBEBE] bg-white px-3 text-sm text-typo_dark-300 laptop-up:min-w-32"
            onChange={(event) =>
              setSelectedYear(Number(event.target.value))
            }
            value={selectedYear}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CHECK_IN_AUDIT_TABS.map((tab) => (
          <button
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold ${
              activeTab === tab.id
                ? "border-selectedButton bg-selectedButton text-white"
                : "border-[#BEBEBE] bg-white"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && !audit ? (
        <div className="flex min-h-48 items-center justify-center">
          <span className="loader-spinner"></span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-error bg-red-50 p-4">
          <p className="text-sm text-error">{error}</p>
          <button
            className="mt-3 rounded-lg border border-error px-4 py-2 text-sm font-bold text-error"
            onClick={() => loadAudit(true)}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}

      {audit && !error ? (
        rows.length === 0 ? (
          <div className="rounded-xl border border-[#BEBEBE] p-6 text-center">
            <p className="font-bold">No confirmed check-ins</p>
            <p className="mt-1 text-sm text-typo_light-200">
              This property has no confirmed check-ins in{" "}
              {CHECK_IN_AUDIT_MONTHS[selectedMonth - 1]} {selectedYear}.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-[#D0D0D0] laptop-up:hidden">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-[#F4F4F4]">
                  <tr>
                    <th className="w-[27%] px-3 py-3">Date</th>
                    <th className="w-[38%] px-3 py-3">Name</th>
                    <th className="w-[27%] px-3 py-3 text-right">
                      Total
                    </th>
                    <th className="w-[8%] px-2 py-3">
                      <span className="sr-only">Open booking</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      className="border-t border-[#E5E5E5]"
                      key={row.bookingId}
                    >
                      <td className="px-3 py-3 text-xs">
                        {formatCheckInAuditDate(row.checkInDate)}
                      </td>
                      <td className="truncate px-3 py-3 font-bold">
                        {row.clientName}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        {formatCheckInAuditMoney(row.total)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          aria-label={`Open booking ${row.bookingId}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-link hover:no-underline"
                          href={{
                            pathname: `/protected/booking/${row.bookingId}`,
                            query: {
                              returnTo:
                                "/protected/settings/check-in-audit",
                            },
                          }}
                        >
                          <span className="material-symbols-outlined">
                            chevron_right
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#D0D0D0] bg-[#F4F4F4]">
                  <tr>
                    <td
                      className="px-3 py-3 text-right font-bold"
                      colSpan={2}
                    >
                      Total
                    </td>
                    <td className="px-3 py-3 text-right font-bold">
                      {formatCheckInAuditMoney(totals.total)}
                    </td>
                    <td aria-hidden="true" className="px-2 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="hidden max-w-full overflow-x-auto rounded-xl border border-[#D0D0D0] laptop-up:block">
              <table className="w-full min-w-[1420px] text-left text-sm">
                <thead className="bg-[#F4F4F4]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Multiple</th>
                    <th className="px-4 py-3 text-right">
                      Advance amount
                    </th>
                    <th className="px-4 py-3">
                      Advance received date
                    </th>
                    <th className="px-4 py-3 text-right">
                      Remaining payment received amount
                    </th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Tax</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="w-12 px-2 py-3">
                      <span className="sr-only">Open booking</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      className="border-t border-[#E5E5E5]"
                      key={row.bookingId}
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatCheckInAuditDate(row.checkInDate)}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {row.clientName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {row.bookingType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {row.multiple ? "true" : "false"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {formatCheckInAuditMoney(row.advanceAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatCheckInAuditDate(
                          row.advanceReceivedDate
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {formatCheckInAuditMoney(
                          row.remainingPaymentAmount
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatCheckInAuditDate(
                          row.remainingPaymentReceivedDate
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {formatCheckInAuditMoney(row.tax)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold">
                        {formatCheckInAuditMoney(row.total)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          aria-label={`Open booking ${row.bookingId}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-link hover:no-underline"
                          href={{
                            pathname: `/protected/booking/${row.bookingId}`,
                            query: {
                              returnTo:
                                "/protected/settings/check-in-audit",
                            },
                          }}
                        >
                          <span className="material-symbols-outlined">
                            chevron_right
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#D0D0D0] bg-[#F4F4F4]">
                  <tr>
                    <td
                      className="px-4 py-3 text-right font-bold"
                      colSpan={8}
                    >
                      Total
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold">
                      {formatCheckInAuditMoney(totals.tax)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold">
                      {formatCheckInAuditMoney(totals.total)}
                    </td>
                    <td aria-hidden="true" className="px-2 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
