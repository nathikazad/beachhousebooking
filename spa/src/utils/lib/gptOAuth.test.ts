import { describe, expect, it } from "vitest";
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  GptOAuthConfig,
  GptOAuthValidationError,
  refreshOAuthTokens,
  verifyGptOAuthAccessToken,
} from "./gptOAuth";

const config: GptOAuthConfig = {
  clientId: "beach-house-operations",
  clientSecret: "client-secret-long-enough",
  signingSecret: "signing-secret-long-enough-for-tests",
  authorizedUserIds: ["nathik-id", "rafica-id", "nishtar-id"],
  redirectUris: ["https://chatgpt.com/oauth/callback"],
};

describe("GPT OAuth tokens", () => {
  it("exchanges an authorized user's code for a usable access token", () => {
    const code = createAuthorizationCode({
      userId: "nathik-id",
      redirectUri: config.redirectUris[0],
      scope: "gpt.read",
      config,
    });
    const tokens = exchangeAuthorizationCode({
      code,
      redirectUri: config.redirectUris[0],
      config,
    });
    expect(verifyGptOAuthAccessToken(tokens.access_token, config)).toEqual({
      userId: "nathik-id",
      scope: "gpt.read",
    });
  });

  it("rejects users outside the three-user allowlist", () => {
    expect(() =>
      createAuthorizationCode({
        userId: "unapproved-id",
        redirectUri: config.redirectUris[0],
        scope: "gpt.read",
        config,
      })
    ).toThrow(GptOAuthValidationError);
  });

  it("binds authorization codes to the exact callback URL", () => {
    const code = createAuthorizationCode({
      userId: "rafica-id",
      redirectUri: config.redirectUris[0],
      scope: "gpt.read",
      config,
    });
    expect(() =>
      exchangeAuthorizationCode({
        code,
        redirectUri: "https://attacker.example/callback",
        config,
      })
    ).toThrow(GptOAuthValidationError);
  });

  it("rejects non-HTTPS callbacks even when configured", () => {
    expect(() =>
      createAuthorizationCode({
        userId: "rafica-id",
        redirectUri: "http://chatgpt.example/callback",
        scope: "gpt.read",
        config: {
          ...config,
          redirectUris: ["http://chatgpt.example/callback"],
        },
      })
    ).toThrow(GptOAuthValidationError);
  });

  it("rotates a refresh token and rechecks the allowlist", () => {
    const code = createAuthorizationCode({
      userId: "nishtar-id",
      redirectUri: config.redirectUris[0],
      scope: "gpt.read",
      config,
    });
    const tokens = exchangeAuthorizationCode({
      code,
      redirectUri: config.redirectUris[0],
      config,
    });
    const refreshed = refreshOAuthTokens({
      refreshToken: tokens.refresh_token,
      config,
    });
    expect(verifyGptOAuthAccessToken(refreshed.access_token, config).userId).toBe(
      "nishtar-id"
    );

    expect(() =>
      refreshOAuthTokens({
        refreshToken: tokens.refresh_token,
        config: { ...config, authorizedUserIds: ["nathik-id", "rafica-id"] },
      })
    ).toThrow(GptOAuthValidationError);
  });
});
