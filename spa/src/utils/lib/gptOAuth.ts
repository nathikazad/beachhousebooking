import * as jwt from "jsonwebtoken";
import { timingSafeEqual } from "crypto";

const OAUTH_ISSUER = "beach-house-booking";
const ACCESS_TOKEN_AUDIENCE = "beach-house-gpt-action";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

type OAuthTokenKind = "authorization_code" | "access_token" | "refresh_token";

interface OAuthTokenPayload extends jwt.JwtPayload {
  sub: string;
  kind: OAuthTokenKind;
  scope?: string;
  redirectUri?: string;
}

export interface GptOAuthConfig {
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  authorizedUserIds: string[];
  redirectUris: string[];
}

export interface GptAccessTokenIdentity {
  userId: string;
  scope: string;
}

export class GptOAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GptOAuthConfigurationError";
  }
}

export class GptOAuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GptOAuthValidationError";
  }
}

function commaSeparated(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new GptOAuthConfigurationError(`${name} is not configured.`);
  }
  return value;
}

export function getGptOAuthConfig(): GptOAuthConfig {
  const authorizedUserIds = commaSeparated(process.env.GPT_AUTHORIZED_USER_IDS);
  const redirectUris = commaSeparated(process.env.GPT_ACTION_OAUTH_REDIRECT_URIS);
  if (authorizedUserIds.length === 0) {
    throw new GptOAuthConfigurationError("GPT_AUTHORIZED_USER_IDS is not configured.");
  }
  if (redirectUris.length === 0) {
    throw new GptOAuthConfigurationError(
      "GPT_ACTION_OAUTH_REDIRECT_URIS is not configured."
    );
  }

  return {
    clientId: requiredEnvironmentValue("GPT_ACTION_OAUTH_CLIENT_ID"),
    clientSecret: requiredEnvironmentValue("GPT_ACTION_OAUTH_CLIENT_SECRET"),
    signingSecret: requiredEnvironmentValue("GPT_ACTION_OAUTH_SIGNING_SECRET"),
    authorizedUserIds,
    redirectUris,
  };
}

export function safelyEqualStrings(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function isAuthorizedGptUser(
  userId: string,
  authorizedUserIds: readonly string[]
): boolean {
  return authorizedUserIds.includes(userId);
}

export function validateOAuthClient(
  suppliedClientId: string,
  suppliedClientSecret: string,
  config: GptOAuthConfig
): void {
  if (
    !safelyEqualStrings(suppliedClientId, config.clientId) ||
    !safelyEqualStrings(suppliedClientSecret, config.clientSecret)
  ) {
    throw new GptOAuthValidationError("Invalid OAuth client credentials.");
  }
}

export function validateOAuthAuthorizationRequest(
  clientId: string,
  redirectUri: string,
  config: GptOAuthConfig
): void {
  if (!safelyEqualStrings(clientId, config.clientId)) {
    throw new GptOAuthValidationError("Unknown OAuth client.");
  }
  if (!config.redirectUris.includes(redirectUri)) {
    throw new GptOAuthValidationError("OAuth redirect URI is not allowed.");
  }
  try {
    if (new URL(redirectUri).protocol !== "https:") {
      throw new Error("OAuth callbacks must use HTTPS.");
    }
  } catch {
    throw new GptOAuthValidationError("OAuth redirect URI is invalid.");
  }
}

function signToken(
  payload: Record<string, unknown>,
  expiresIn: number,
  audience: string,
  signingSecret: string
): string {
  return jwt.sign(payload, signingSecret, {
    algorithm: "HS256",
    expiresIn,
    issuer: OAUTH_ISSUER,
    audience,
  });
}

function verifyToken(
  token: string,
  expectedKind: OAuthTokenKind,
  audience: string,
  signingSecret: string
): OAuthTokenPayload {
  let verified: string | jwt.JwtPayload;
  try {
    verified = jwt.verify(token, signingSecret, {
      algorithms: ["HS256"],
      issuer: OAUTH_ISSUER,
      audience,
    });
  } catch {
    throw new GptOAuthValidationError("Invalid or expired OAuth token.");
  }
  if (
    typeof verified === "string" ||
    typeof verified.sub !== "string" ||
    verified.kind !== expectedKind
  ) {
    throw new GptOAuthValidationError("Invalid OAuth token.");
  }
  return verified as OAuthTokenPayload;
}

export function createAuthorizationCode(input: {
  userId: string;
  redirectUri: string;
  scope: string;
  config: GptOAuthConfig;
}): string {
  if (!isAuthorizedGptUser(input.userId, input.config.authorizedUserIds)) {
    throw new GptOAuthValidationError("This user is not authorized for the GPT.");
  }
  validateOAuthAuthorizationRequest(
    input.config.clientId,
    input.redirectUri,
    input.config
  );
  return signToken(
    {
      sub: input.userId,
      kind: "authorization_code",
      redirectUri: input.redirectUri,
      scope: input.scope,
    },
    AUTHORIZATION_CODE_TTL_SECONDS,
    input.config.clientId,
    input.config.signingSecret
  );
}

export function exchangeAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  config: GptOAuthConfig;
}) {
  const payload = verifyToken(
    input.code,
    "authorization_code",
    input.config.clientId,
    input.config.signingSecret
  );
  if (payload.redirectUri !== input.redirectUri) {
    throw new GptOAuthValidationError("OAuth redirect URI does not match.");
  }
  if (!isAuthorizedGptUser(payload.sub, input.config.authorizedUserIds)) {
    throw new GptOAuthValidationError("This user is not authorized for the GPT.");
  }
  return createOAuthTokenPair(payload.sub, payload.scope ?? "gpt.read", input.config);
}

export function refreshOAuthTokens(input: {
  refreshToken: string;
  config: GptOAuthConfig;
}) {
  const payload = verifyToken(
    input.refreshToken,
    "refresh_token",
    input.config.clientId,
    input.config.signingSecret
  );
  if (!isAuthorizedGptUser(payload.sub, input.config.authorizedUserIds)) {
    throw new GptOAuthValidationError("This user is not authorized for the GPT.");
  }
  return createOAuthTokenPair(payload.sub, payload.scope ?? "gpt.read", input.config);
}

function createOAuthTokenPair(
  userId: string,
  scope: string,
  config: GptOAuthConfig
) {
  return {
    access_token: signToken(
      { sub: userId, kind: "access_token", scope },
      ACCESS_TOKEN_TTL_SECONDS,
      ACCESS_TOKEN_AUDIENCE,
      config.signingSecret
    ),
    token_type: "Bearer" as const,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: signToken(
      { sub: userId, kind: "refresh_token", scope },
      REFRESH_TOKEN_TTL_SECONDS,
      config.clientId,
      config.signingSecret
    ),
    scope,
  };
}

export function verifyGptOAuthAccessToken(
  token: string,
  config: GptOAuthConfig
): GptAccessTokenIdentity {
  const payload = verifyToken(
    token,
    "access_token",
    ACCESS_TOKEN_AUDIENCE,
    config.signingSecret
  );
  if (!isAuthorizedGptUser(payload.sub, config.authorizedUserIds)) {
    throw new GptOAuthValidationError("This user is not authorized for the GPT.");
  }
  return { userId: payload.sub, scope: payload.scope ?? "gpt.read" };
}
