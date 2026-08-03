import { afterEach, describe, expect, it } from "vitest";
import {
  isValidGptActionAuthorization,
  verifyGptActionRequest,
} from "./gptActionAuth";
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  GptOAuthConfig,
} from "./gptOAuth";

const oauthEnvironmentNames = [
  "GPT_ACTION_API_KEY",
  "GPT_AUTHORIZED_USER_IDS",
  "GPT_ACTION_OAUTH_CLIENT_ID",
  "GPT_ACTION_OAUTH_CLIENT_SECRET",
  "GPT_ACTION_OAUTH_SIGNING_SECRET",
  "GPT_ACTION_OAUTH_REDIRECT_URIS",
] as const;

const originalEnvironment = Object.fromEntries(
  oauthEnvironmentNames.map((name) => [name, process.env[name]])
);

afterEach(() => {
  for (const name of oauthEnvironmentNames) {
    const original = originalEnvironment[name];
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});

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

  it("accepts an OAuth access token only for an allowlisted user", () => {
    const config: GptOAuthConfig = {
      clientId: "beach-house-operations",
      clientSecret: "client-secret",
      signingSecret: "signing-secret-long-enough-for-tests",
      authorizedUserIds: ["nathik-id"],
      redirectUris: ["https://chatgpt.com/oauth/callback"],
    };
    process.env.GPT_AUTHORIZED_USER_IDS = config.authorizedUserIds.join(",");
    process.env.GPT_ACTION_OAUTH_CLIENT_ID = config.clientId;
    process.env.GPT_ACTION_OAUTH_CLIENT_SECRET = config.clientSecret;
    process.env.GPT_ACTION_OAUTH_SIGNING_SECRET = config.signingSecret;
    process.env.GPT_ACTION_OAUTH_REDIRECT_URIS = config.redirectUris.join(",");
    delete process.env.GPT_ACTION_API_KEY;

    const code = createAuthorizationCode({
      userId: "nathik-id",
      redirectUri: config.redirectUris[0],
      scope: "gpt.read",
      config,
    });
    const token = exchangeAuthorizationCode({
      code,
      redirectUri: config.redirectUris[0],
      config,
    }).access_token;

    expect(() =>
      verifyGptActionRequest({
        headers: { authorization: `Bearer ${token}` },
      } as never)
    ).not.toThrow();
    process.env.GPT_AUTHORIZED_USER_IDS = "someone-else";
    expect(() =>
      verifyGptActionRequest({
        headers: { authorization: `Bearer ${token}` },
      } as never)
    ).toThrow("Invalid GPT Action credentials.");
  });
});
