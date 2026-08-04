import { describe, expect, it } from "vitest";
import {
  employeeReportConversionRate,
  employeeReportMonthBounds,
  employeeReportRowFromDatabase,
  employeeReportYears,
  isConvertedEmployeeEnquiry,
} from "./employeeReports";

describe("employee reports", () => {
  it("uses Indian month boundaries", () => {
    expect(employeeReportMonthBounds(7, 2026)).toEqual({
      start: "2026-07-31T18:30:00.000Z",
      end: "2026-08-31T18:30:00.000Z",
    });
  });

  it("includes five past years and one future year", () => {
    expect(employeeReportYears(2026)).toEqual([
      2021, 2022, 2023, 2024, 2025, 2026, 2027,
    ]);
  });

  it("calculates conversion without dividing by zero", () => {
    expect(employeeReportConversionRate(3, 8)).toBe(37.5);
    expect(employeeReportConversionRate(0, 0)).toBe(0);
  });

  it("normalizes booking rows and treats only confirmed as converted", () => {
    const row = employeeReportRowFromDatabase({
      id: "42",
      client_name: "Balachandar",
      created_at: "2026-08-04T08:00:00Z",
      check_in: "2026-08-19T08:00:00Z",
      status: "confirmed",
      total_cost: "120000",
    });

    expect(row).toMatchObject({
      id: 42,
      clientName: "Balachandar",
      totalCost: 120000,
    });
    expect(isConvertedEmployeeEnquiry(row)).toBe(true);
    expect(
      isConvertedEmployeeEnquiry({ ...row, status: "preconfirmed" })
    ).toBe(false);
  });
});
