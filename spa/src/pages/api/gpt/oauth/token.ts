import { NextApiRequest, NextApiResponse } from "next";
import {
  exchangeAuthorizationCode,
  getGptOAuthConfig,
  GptOAuthConfigurationError,
  GptOAuthValidationError,
  refreshOAuthTokens,
  validateOAuthClient,
} from "@/utils/lib/gptOAuth";

function bodyValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clientCredentials(req: NextApiRequest) {
  const basic = req.headers.authorization?.match(/^Basic\s+(.+)$/i);
  if (basic) {
    const decoded = Buffer.from(basic[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator >= 0) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, separator)),
        clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
      };
    }
  }
  return {
    clientId: bodyValue(req.body.client_id),
    clientSecret: bodyValue(req.body.client_secret),
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const config = getGptOAuthConfig();
    const credentials = clientCredentials(req);
    validateOAuthClient(credentials.clientId, credentials.clientSecret, config);
    const grantType = bodyValue(req.body.grant_type);

    if (grantType === "authorization_code") {
      const code = bodyValue(req.body.code);
      const redirectUri = bodyValue(req.body.redirect_uri);
      if (!code || !redirectUri) {
        return res.status(400).json({ error: "invalid_request" });
      }
      return res.status(200).json(
        exchangeAuthorizationCode({ code, redirectUri, config })
      );
    }
    if (grantType === "refresh_token") {
      const refreshToken = bodyValue(req.body.refresh_token);
      if (!refreshToken) {
        return res.status(400).json({ error: "invalid_request" });
      }
      return res.status(200).json(refreshOAuthTokens({ refreshToken, config }));
    }
    return res.status(400).json({ error: "unsupported_grant_type" });
  } catch (error) {
    if (error instanceof GptOAuthValidationError) {
      return res.status(401).json({ error: "invalid_grant", message: error.message });
    }
    if (error instanceof GptOAuthConfigurationError) {
      console.error("GPT OAuth configuration error:", error.message);
      return res.status(503).json({ error: "temporarily_unavailable" });
    }
    console.error("GPT OAuth token exchange failed:", error);
    return res.status(500).json({ error: "server_error" });
  }
}
