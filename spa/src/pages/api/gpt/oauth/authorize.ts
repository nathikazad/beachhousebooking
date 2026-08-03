import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  createAuthorizationCode,
  getGptOAuthConfig,
  GptOAuthConfigurationError,
  GptOAuthValidationError,
  isAuthorizedGptUser,
  validateOAuthAuthorizationRequest,
} from "@/utils/lib/gptOAuth";

function bodyValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const config = getGptOAuthConfig();
    const clientId = bodyValue(req.body.client_id);
    const redirectUri = bodyValue(req.body.redirect_uri);
    const responseType = bodyValue(req.body.response_type);
    const state = bodyValue(req.body.state);
    const scope = bodyValue(req.body.scope) || "gpt.read";
    if (responseType !== "code") {
      return res.status(400).json({ error: "unsupported_response_type" });
    }
    validateOAuthAuthorizationRequest(clientId, redirectUri, config);

    const authorization = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    if (!authorization) {
      return res.status(401).json({ error: "login_required" });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data, error } = await supabase.auth.getUser(authorization[1]);
    if (error || !data.user) {
      return res.status(401).json({ error: "login_required" });
    }
    if (!isAuthorizedGptUser(data.user.id, config.authorizedUserIds)) {
      return res.status(403).json({
        error: "access_denied",
        message: "This account is not authorized for Beach House Operations.",
      });
    }

    const code = createAuthorizationCode({
      userId: data.user.id,
      redirectUri,
      scope,
      config,
    });
    const redirect = new URL(redirectUri);
    redirect.searchParams.set("code", code);
    if (state) redirect.searchParams.set("state", state);
    return res.status(200).json({ redirectTo: redirect.toString() });
  } catch (error) {
    if (error instanceof GptOAuthValidationError) {
      return res.status(400).json({ error: "invalid_request", message: error.message });
    }
    if (error instanceof GptOAuthConfigurationError) {
      console.error("GPT OAuth configuration error:", error.message);
      return res.status(503).json({ error: "temporarily_unavailable" });
    }
    console.error("GPT OAuth authorization failed:", error);
    return res.status(500).json({ error: "server_error" });
  }
}
