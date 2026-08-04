"use client";

import InquiriesVsConfirmed from "./InquiriesVsConfirmed";
import IncomeFromCheckin from "./IncomeFromCheckin";
import LoadingButton from "@/components/ui/LoadingButton";
import {
  firstTableName,
  formatCompactTableAmount,
  formatCompactTableDate,
} from "@/components/BookingListTable";
import { supabase } from "@/utils/supabase/client";
import {
  EMPLOYEE_REPORT_EMPLOYEES,
  EMPLOYEE_REPORT_MONTHS,
  EmployeeReportBookingRow,
  EmployeeReportEmployee,
  employeeReportConversionRate,
  employeeReportMonthBounds,
  employeeReportRowFromDatabase,
  employeeReportYears,
  isConvertedEmployeeEnquiry,
} from "@/utils/lib/employeeReports";
import format from "date-fns/format";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

type EmployeeReportTab = "enquiries" | "checkins";

interface ReportResponse {
  daily: Record<string, Record<string, number>>;
  monthly: Record<string, number>;
}

const EMPTY_REPORT: ReportResponse = { daily: {}, monthly: {} };
const PAGE_SIZE = 15;

function fullDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd MMM yy");
}

function fullAmount(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-24 flex-col justify-center gap-2 rounded-xl bg-typo_light-100 px-4 py-3">
      <span className="text-xs font-medium text-typo_dark-100">{label}</span>
      <span className="text-xl font-semibold text-typo_dark-300">{value}</span>
    </div>
  );
}

function ReportDate({ value }: { value: string }) {
  return (
    <>
      <span className="table-wide-up:hidden">{formatCompactTableDate(value)}</span>
      <span className="hidden table-wide-up:inline">{fullDate(value)}</span>
    </>
  );
}

function ReportName({ value }: { value: string }) {
  return (
    <span className="block min-w-0 truncate" title={value}>
      <span className="table-wide-up:hidden">{firstTableName(value)}</span>
      <span className="hidden table-wide-up:inline">{value}</span>
    </span>
  );
}

function EmployeeReportTable({
  tab,
  rows,
  onSelect,
}: {
  tab: EmployeeReportTab;
  rows: EmployeeReportBookingRow[];
  onSelect: (id: number) => void;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-gray-200 px-4 py-10 text-center text-sm text-typo_dark-100">
        No matching bookings for this month.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full table-auto text-left text-sm">
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-slate-500 table-wide-up:text-xs">
          <tr>
            {tab === "enquiries" ? (
              <>
                <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">Received</th>
                <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">Check-in</th>
                <th className="w-[clamp(10rem,22vw,20rem)] max-w-[clamp(10rem,22vw,20rem)] px-2 py-3 table-wide-up:px-3">Name</th>
                <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">Converted</th>
              </>
            ) : (
              <>
                <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">Check-in</th>
                <th className="w-px whitespace-nowrap px-2 py-3 table-wide-up:px-3">Booked on</th>
                <th className="w-[clamp(10rem,22vw,20rem)] max-w-[clamp(10rem,22vw,20rem)] px-2 py-3 table-wide-up:px-3">Name</th>
                <th className="w-px whitespace-nowrap px-2 py-3 text-right table-wide-up:px-3">Amount</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const converted = isConvertedEmployeeEnquiry(row);
            return (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => onSelect(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row.id);
                  }
                }}
                className="cursor-pointer bg-white hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
              >
                {tab === "enquiries" ? (
                  <>
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600 table-wide-up:px-3"><ReportDate value={row.createdAt} /></td>
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600 table-wide-up:px-3"><ReportDate value={row.checkIn} /></td>
                    <td className="w-[clamp(10rem,22vw,20rem)] min-w-[10ch] max-w-[clamp(10rem,22vw,20rem)] px-2 py-3 font-medium text-neutral-900 table-wide-up:px-3"><ReportName value={row.clientName} /></td>
                    <td className="whitespace-nowrap px-2 py-3 table-wide-up:px-3">
                      {converted ? (
                        <span className="font-medium text-green-700">
                          Yes · <span className="table-wide-up:hidden">{formatCompactTableAmount(row.totalCost)}</span><span className="hidden table-wide-up:inline">{fullAmount(row.totalCost)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">No</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600 table-wide-up:px-3"><ReportDate value={row.checkIn} /></td>
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600 table-wide-up:px-3"><ReportDate value={row.createdAt} /></td>
                    <td className="w-[clamp(10rem,22vw,20rem)] min-w-[10ch] max-w-[clamp(10rem,22vw,20rem)] px-2 py-3 font-medium text-neutral-900 table-wide-up:px-3"><ReportName value={row.clientName} /></td>
                    <td className="whitespace-nowrap px-2 py-3 text-right font-medium text-neutral-900 table-wide-up:px-3"><span className="table-wide-up:hidden">{formatCompactTableAmount(row.totalCost)}</span><span className="hidden table-wide-up:inline">{fullAmount(row.totalCost)}</span></td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function EmployeeReportsView() {
  const router = useRouter();
  const now = new Date();
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [employee, setEmployee] = useState<EmployeeReportEmployee>("Thejas");
  const [tab, setTab] = useState<EmployeeReportTab>("enquiries");
  const [reservationReport, setReservationReport] = useState<ReportResponse>(EMPTY_REPORT);
  const [checkinReport, setCheckinReport] = useState<ReportResponse>(EMPTY_REPORT);
  const [enquiryRows, setEnquiryRows] = useState<EmployeeReportBookingRow[]>([]);
  const [checkinRows, setCheckinRows] = useState<EmployeeReportBookingRow[]>([]);
  const [visibleRows, setVisibleRows] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const years = employeeReportYears(now.getFullYear());
  const monthName = EMPLOYEE_REPORT_MONTHS[monthIndex];

  useEffect(() => {
    const requestId = ++requestRef.current;
    const bounds = employeeReportMonthBounds(monthIndex, year);
    setLoading(true);
    setError(null);
    setVisibleRows(PAGE_SIZE);

    const reservationStats = supabase.rpc("get_booking_stats", {
      month: monthIndex + 1,
      year,
      employee,
      referral: null,
    });
    const checkinStats = supabase.rpc("get_checkin_stats", {
      month: monthIndex + 1,
      year,
      employee,
      referral: null,
    });
    const enquiries = supabase
      .from("bookings")
      .select("id,client_name,created_at,check_in,status,total_cost")
      .eq("email", employee)
      .gte("created_at", bounds.start)
      .lt("created_at", bounds.end)
      .order("created_at", { ascending: false });
    const checkins = supabase
      .from("bookings")
      .select("id,client_name,created_at,check_in,status,total_cost")
      .eq("email", employee)
      .eq("status", "confirmed")
      .gte("check_in", bounds.start)
      .lt("check_in", bounds.end)
      .order("check_in", { ascending: true });

    Promise.all([reservationStats, checkinStats, enquiries, checkins])
      .then(([reservationResult, checkinResult, enquiryResult, rowCheckinResult]) => {
        if (requestRef.current !== requestId) return;
        const firstError = reservationResult.error || checkinResult.error || enquiryResult.error || rowCheckinResult.error;
        if (firstError) throw firstError;
        setReservationReport((reservationResult.data as ReportResponse) || EMPTY_REPORT);
        setCheckinReport((checkinResult.data as ReportResponse) || EMPTY_REPORT);
        setEnquiryRows((enquiryResult.data || []).map((row) => employeeReportRowFromDatabase(row)));
        setCheckinRows((rowCheckinResult.data || []).map((row) => employeeReportRowFromDatabase(row)));
      })
      .catch((fetchError) => {
        if (requestRef.current !== requestId) return;
        console.error("Unable to load employee reports", fetchError);
        setError("Employee report data could not be loaded. Please try again.");
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, [employee, monthIndex, year]);

  const monthlyReservations = reservationReport.monthly || {};
  const monthlyCheckins = checkinReport.monthly || {};
  const enquiryCount = Number(monthlyReservations.inquiriesCount || 0);
  const confirmedCount = Number(monthlyReservations.confirmedCount || 0);
  const conversion = employeeReportConversionRate(confirmedCount, enquiryCount);
  const activeRows = tab === "enquiries" ? enquiryRows : checkinRows;

  return (
    <div className="flex w-full flex-col gap-5 px-2 pb-10 !select-none mobile-up:px-6 laptop-up:px-10">
      <div className="flex h-[72px] items-center">
        <button aria-label="Back" onClick={() => router.back()} className="material-symbols-outlined cursor-pointer hover:text-selectedButton">arrow_back</button>
        <h1 className="w-full text-center text-lg font-bold leading-6">Employee Reports</h1>
        <span className="w-6" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-1 gap-3 tablet-up:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-typo_dark-100">Month<select aria-label="Month" value={monthIndex} onChange={(event) => setMonthIndex(Number(event.target.value))} className="h-12 rounded-lg border border-gray-200 bg-typo_light-100 px-3 text-sm text-typo_dark-300">{EMPLOYEE_REPORT_MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-typo_dark-100">Year<select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-12 rounded-lg border border-gray-200 bg-typo_light-100 px-3 text-sm text-typo_dark-300">{years.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-typo_dark-100">Employee<select aria-label="Employee" value={employee} onChange={(event) => setEmployee(event.target.value as EmployeeReportEmployee)} className="h-12 rounded-lg border border-gray-200 bg-typo_light-100 px-3 text-sm text-typo_dark-300">{EMPLOYEE_REPORT_EMPLOYEES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      </div>

      <div role="tablist" aria-label="Employee report type" className="grid grid-cols-2 rounded-xl border border-typo_dark-300 p-1">
        <button role="tab" aria-selected={tab === "enquiries"} onClick={() => { setTab("enquiries"); setVisibleRows(PAGE_SIZE); }} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "enquiries" ? "bg-selectedButton text-white" : "text-typo_dark-300"}`}>New Enquiries</button>
        <button role="tab" aria-selected={tab === "checkins"} onClick={() => { setTab("checkins"); setVisibleRows(PAGE_SIZE); }} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "checkins" ? "bg-selectedButton text-white" : "text-typo_dark-300"}`}>Check-ins</button>
      </div>

      <p className="min-h-10 text-sm leading-5 text-typo_dark-100">
        {tab === "enquiries" ? <>Enquiries handled by <strong>{employee}</strong> in {monthName}. See when each enquiry arrived, whether it became a confirmed booking, and how much it is worth.</> : <>Confirmed bookings handled by <strong>{employee}</strong> that check in during {monthName}. The booking may have been made in an earlier month.</>}
      </p>

      {error ? <div className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</div> : null}

      {tab === "enquiries" ? (
        <>
          <div className="grid grid-cols-2 gap-3 desktop-up:grid-cols-4">
            <StatCard label="New enquiries" value={enquiryCount.toLocaleString("en-IN")} />
            <StatCard label="Confirmed" value={confirmedCount.toLocaleString("en-IN")} />
            <StatCard label="Converted" value={`${Number.isInteger(conversion) ? conversion : conversion.toFixed(1)}%`} />
            <StatCard label="Booking value" value={fullAmount(Number(monthlyReservations.confirmedSum || 0))} />
          </div>
          <section><h2 className="title">Enquiries by day</h2><InquiriesVsConfirmed data={reservationReport} /></section>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 desktop-up:grid-cols-4">
            <StatCard label="Check-ins" value={Number(monthlyCheckins.count || 0).toLocaleString("en-IN")} />
            <StatCard label="Check-in value" value={fullAmount(Number(monthlyCheckins.sum || 0))} />
            <StatCard label="Average value" value={fullAmount(Number(monthlyCheckins.average || 0))} />
            <StatCard label="Tax" value={fullAmount(Number(monthlyCheckins.taxTotal || 0))} />
          </div>
          <section><h2 className="title">Check-in value by day</h2><IncomeFromCheckin data={checkinReport} /></section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="title">{tab === "enquiries" ? "Enquiry details" : "Check-in details"}</h2>
        {loading ? <div className="flex min-h-40 items-center justify-center"><div className="loader-spinner" aria-label="Loading employee report" /></div> : <EmployeeReportTable tab={tab} rows={activeRows.slice(0, visibleRows)} onSelect={(id) => router.push(`/protected/booking/${id}?returnTo=${encodeURIComponent("/protected/reports/employees")}`)} />}
        {!loading && visibleRows < activeRows.length ? <LoadingButton className="w-full rounded-xl border border-selectedButton px-4 py-2 text-selectedButton" onClick={() => setVisibleRows((current) => current + PAGE_SIZE)}>Load more</LoadingButton> : null}
      </section>
    </div>
  );
}
