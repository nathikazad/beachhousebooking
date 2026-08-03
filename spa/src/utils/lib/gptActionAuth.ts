import { timingSafeEqual } from "crypto";
import { NextApiRequest } from "next";
import { getGptOAuthConfig, verifyGptOAuthAccessToken } from "./gptOAuth";

export class GptActionAuthenticationError extends Error {
  constructor() {
    super("Invalid GPT Action credentials.");
    this.name = "GptActionAuthenticationError";
  }
}

export function isValidGptActionAuthorization(
  authorization: string | undefined,
  expectedSecret: string | undefined
): boolean {
  if (!authorization || !expectedSecret) return false;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const supplied = Buffer.from(match[1], "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyGptActionRequest(request: NextApiRequest): void {
  const authorization = request.headers.authorization;
  if (
    process.env.GPT_ACTION_API_KEY &&
    isValidGptActionAuthorization(authorization, process.env.GPT_ACTION_API_KEY)
  ) return;

  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new GptActionAuthenticationError();
  try {
    verifyGptOAuthAccessToken(match[1], getGptOAuthConfig());
  } catch {
    throw new GptActionAuthenticationError();
  }
}
