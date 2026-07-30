import { NextApiRequest, NextApiResponse } from "next";
import { verifyAndGetPayload } from "@/utils/lib/auth";
import { fetchCheckInAudit } from "@/utils/lib/db";

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
      message: "Please sign in again to view the check-in audit.",
    });
  }

  try {
    const rows = await fetchCheckInAudit();
    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      rows,
    });
  } catch (error) {
    console.error("Error fetching check-in audit:", error);
    return res.status(500).json({
      error: "CHECK_IN_AUDIT_FAILED",
      message: "Unable to load the check-in audit. Please try again.",
    });
  }
}
