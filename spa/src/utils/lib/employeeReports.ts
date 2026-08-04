export const EMPLOYEE_REPORT_EMPLOYEES = [
  "Thejas",
  "Yasmeen",
  "Rafica",
  "Indhu",
] as const;

export type EmployeeReportEmployee =
  (typeof EMPLOYEE_REPORT_EMPLOYEES)[number];

export const EMPLOYEE_REPORT_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type EmployeeReportMonth = (typeof EMPLOYEE_REPORT_MONTHS)[number];

export interface EmployeeReportBookingRow {
  id: number;
  clientName: string;
  createdAt: string;
  checkIn: string;
  status: string;
  totalCost: number;
}

export function employeeReportMonthBounds(
  monthIndex: number,
  year: number
): { start: string; end: string } {
  const indiaOffset = 5.5 * 60 * 60 * 1000;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1) - indiaOffset).toISOString(),
    end: new Date(Date.UTC(year, monthIndex + 1, 1) - indiaOffset).toISOString(),
  };
}

export function employeeReportYears(currentYear: number): number[] {
  return Array.from({ length: 7 }, (_, index) => currentYear - 5 + index);
}

export function employeeReportConversionRate(
  confirmedCount: number,
  enquiriesCount: number
): number {
  if (!enquiriesCount) return 0;
  return (confirmedCount / enquiriesCount) * 100;
}

export function employeeReportRowFromDatabase(
  row: Record<string, unknown>
): EmployeeReportBookingRow {
  return {
    id: Number(row.id),
    clientName: String(row.client_name ?? "—"),
    createdAt: String(row.created_at ?? ""),
    checkIn: String(row.check_in ?? ""),
    status: String(row.status ?? ""),
    totalCost: Number(row.total_cost ?? 0),
  };
}

export function isConvertedEmployeeEnquiry(
  row: EmployeeReportBookingRow
): boolean {
  return row.status.toLowerCase() === "confirmed";
}
