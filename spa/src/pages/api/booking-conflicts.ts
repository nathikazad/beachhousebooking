import { verifyAndGetPayload } from "@/utils/lib/auth";
import { groupBookingConflicts } from "@/utils/lib/conflictAudit";
import { fetchUpcomingBookingConflicts } from "@/utils/lib/db";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    verifyAndGetPayload(req);
  } catch {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Please sign in again to view double bookings.",
    });
  }

  try {
    const conflicts = await fetchUpcomingBookingConflicts();
    const groups = groupBookingConflicts(conflicts);

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      conflictPeriodCount: conflicts.length,
      conflictGroupCount: groups.length,
      groups,
    });
  } catch (error) {
    console.error("Error fetching double bookings:", error);
    return res.status(500).json({
      error: "DOUBLE_BOOKING_AUDIT_FAILED",
      message: "Unable to load double bookings. Please try again.",
    });
  }
}
