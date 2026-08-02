import { verifyAndGetPayload } from "@/utils/lib/auth";
import { NextApiRequest, NextApiResponse } from "next";

const cacheSources = new Set([
  "history-cache",
  "latest-cache",
  "inflight",
  "network",
]);

function finiteNumber(value: unknown, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(value, maximum)
    : null;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const user = verifyAndGetPayload(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const bookingId = Number(body?.bookingId);
    const cacheSource = String(body?.cacheSource ?? "");
    const browserSessionId = String(body?.browserSessionId ?? "");

    if (
      body?.event !== "booking_read_performance" ||
      !Number.isSafeInteger(bookingId) ||
      bookingId <= 0 ||
      !cacheSources.has(cacheSource) ||
      !/^[0-9a-f-]{36}$/i.test(browserSessionId)
    ) {
      return res.status(400).json({ error: "INVALID_PERFORMANCE_METRIC" });
    }

    const metric = {
      event: "booking_read_performance",
      bookingId,
      userId: user.sub,
      browserSessionId,
      cacheSource,
      totalMs: finiteNumber(body.totalMs, 120_000),
      supabaseMs: finiteNumber(body.supabaseMs, 120_000),
      hydrateMs: finiteNumber(body.hydrateMs, 120_000),
      payloadBytes: finiteNumber(body.payloadBytes, 10_000_000),
      success: body.success === true,
      errorCode:
        typeof body.errorCode === "string"
          ? body.errorCode.slice(0, 100)
          : undefined,
      deployment: process.env.VERCEL_GIT_COMMIT_SHA,
    };

    console.log(JSON.stringify(metric));
    return res.status(204).end();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
}
