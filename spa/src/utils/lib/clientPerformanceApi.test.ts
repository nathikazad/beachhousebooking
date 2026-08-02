import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAndGetPayload: vi.fn(),
}));

vi.mock("@/utils/lib/auth", () => ({
  verifyAndGetPayload: mocks.verifyAndGetPayload,
}));

import handler from "../../pages/api/client-performance";

function response() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.end.mockReturnValue(res);
  return res;
}

describe("client performance logging endpoint", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.verifyAndGetPayload.mockReturnValue({ sub: "user-1" });
  });

  it("writes a structured authenticated booking metric to runtime logs", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = response();

    handler(
      {
        method: "POST",
        body: {
          event: "booking_read_performance",
          bookingId: 3126,
          browserSessionId: "123e4567-e89b-12d3-a456-426614174000",
          cacheSource: "network",
          totalMs: 421.5,
          supabaseMs: 417.2,
          hydrateMs: 0.8,
          payloadBytes: 1554,
          success: true,
        },
      } as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(204);
    expect(info).toHaveBeenCalledOnce();
    expect(JSON.parse(info.mock.calls[0][0])).toMatchObject({
      event: "booking_read_performance",
      bookingId: 3126,
      userId: "user-1",
      cacheSource: "network",
      totalMs: 421.5,
    });
  });

  it("rejects malformed metrics without logging them", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = response();

    handler(
      { method: "POST", body: { bookingId: "not-an-id" } } as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(info).not.toHaveBeenCalled();
  });
});
