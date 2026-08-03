import { describe, expect, it } from "vitest";
import { isValidGptActionAuthorization } from "./gptActionAuth";

describe("GPT action authentication", () => {
  it("accepts only the configured bearer token", () => {
    expect(isValidGptActionAuthorization("Bearer private-key", "private-key")).toBe(true);
    expect(isValidGptActionAuthorization("Bearer wrong-key", "private-key")).toBe(false);
    expect(isValidGptActionAuthorization("Basic private-key", "private-key")).toBe(false);
    expect(isValidGptActionAuthorization(undefined, "private-key")).toBe(false);
  });

  it("rejects an unset server secret", () => {
    expect(isValidGptActionAuthorization("Bearer private-key", undefined)).toBe(false);
  });
});
