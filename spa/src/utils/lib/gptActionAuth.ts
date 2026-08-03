import { timingSafeEqual } from "crypto";
import { NextApiRequest } from "next";

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
  if (
    !isValidGptActionAuthorization(
      request.headers.authorization,
      process.env.GPT_ACTION_API_KEY
    )
  ) {
    throw new GptActionAuthenticationError();
  }
}
