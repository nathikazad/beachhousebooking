import { describe, expect, it } from "vitest";

import { toIndianAuthPhone } from "./indianPhone";

describe("Indian authentication phone numbers", () => {
  it("adds the Indian country code to valid mobile numbers", () => {
    expect(toIndianAuthPhone("9876543210")).toBe("+919876543210");
  });

  it("trims surrounding whitespace", () => {
    expect(toIndianAuthPhone(" 9876543210 ")).toBe("+919876543210");
  });

  it.each([
    "5876543210",
    "987654321",
    "98765432100",
    "+919876543210",
    "98765abc10",
    "",
  ])("rejects invalid or non-national-format number %s", (phone) => {
    expect(toIndianAuthPhone(phone)).toBeNull();
  });
});
