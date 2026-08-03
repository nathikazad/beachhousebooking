import { NextApiRequest, NextApiResponse } from "next";
import { createGptActionOpenApi } from "@/utils/lib/gptActionOpenApi";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  const forwardedProto = Array.isArray(req.headers["x-forwarded-proto"])
    ? req.headers["x-forwarded-proto"][0]
    : req.headers["x-forwarded-proto"];
  const forwardedHost = Array.isArray(req.headers["x-forwarded-host"])
    ? req.headers["x-forwarded-host"][0]
    : req.headers["x-forwarded-host"];
  const protocol = forwardedProto ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = forwardedHost ?? req.headers.host;
  if (!host) {
    return res.status(500).json({ error: "Unable to determine API host." });
  }
  return res.status(200).json(createGptActionOpenApi(`${protocol}://${host}`));
}
