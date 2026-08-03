import { NextApiRequest, NextApiResponse } from "next";
import {
  GptActionAuthenticationError,
  verifyGptActionRequest,
} from "./gptActionAuth";
import { GptActionInputError } from "./gptActions";

export function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function queryInteger(
  value: string | string[] | undefined,
  name: string
): number | undefined {
  const raw = queryValue(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new GptActionInputError(`${name} must be an integer.`);
  }
  return parsed;
}

export function queryBoolean(
  value: string | string[] | undefined,
  name: string
): boolean | undefined {
  const raw = queryValue(value);
  if (raw === undefined) return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new GptActionInputError(`${name} must be true or false.`);
}

export function prepareGptActionRequest(
  req: NextApiRequest,
  res: NextApiResponse
): boolean {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({
      error: "METHOD_NOT_ALLOWED",
      message: `Method ${req.method} is not allowed.`,
    });
    return false;
  }
  try {
    verifyGptActionRequest(req);
    return true;
  } catch {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Valid GPT Action credentials are required.",
    });
    return false;
  }
}

export function sendGptActionError(
  res: NextApiResponse,
  error: unknown,
  operation: string
) {
  if (error instanceof GptActionInputError) {
    return res.status(400).json({ error: "INVALID_INPUT", message: error.message });
  }
  if (error instanceof GptActionAuthenticationError) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Valid GPT Action credentials are required.",
    });
  }
  if (error instanceof Error && error.message === "Booking not found") {
    return res.status(404).json({
      error: "BOOKING_NOT_FOUND",
      message: "Booking not found.",
    });
  }
  console.error(`GPT Action ${operation} failed:`, error);
  return res.status(500).json({
    error: "ACTION_FAILED",
    message: "The requested operation could not be completed.",
  });
}
