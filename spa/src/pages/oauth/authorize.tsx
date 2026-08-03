import LoadingButton from "@/components/ui/LoadingButton";
import { toIndianAuthPhone } from "@/utils/lib/indianPhone";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

const queryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value ?? "";

const OAuthAuthorize = () => {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const oauthRequest = useMemo(
    () => ({
      client_id: queryValue(router.query.client_id),
      redirect_uri: queryValue(router.query.redirect_uri),
      response_type: queryValue(router.query.response_type),
      scope: queryValue(router.query.scope),
      state: queryValue(router.query.state),
    }),
    [router.query]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
  }, []);

  const authorize = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    try {
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const authPhone = toIndianAuthPhone(phone);
        if (!authPhone) throw new Error("Enter a valid 10-digit Indian mobile number.");
        if (!password) throw new Error("Enter your password.");
        const result = await supabase.auth.signInWithPassword({
          phone: authPhone,
          password,
        });
        if (result.error || !result.data.session) {
          throw new Error("Incorrect phone number or password.");
        }
        session = result.data.session;
      }

      const response = await fetch("/api/gpt/oauth/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(oauthRequest),
      });
      const result = await response.json();
      if (!response.ok || typeof result.redirectTo !== "string") {
        throw new Error(
          result.message ?? "This account cannot access Beach House Operations."
        );
      }
      window.location.assign(result.redirectTo);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authorization failed.");
    } finally {
      setLoading(false);
    }
  };

  const switchAccount = async () => {
    setLoading(true);
    setErrorMessage(null);
    await supabase.auth.signOut();
    setHasSession(false);
    setLoading(false);
  };

  if (
    router.isReady &&
    (!oauthRequest.client_id ||
      !oauthRequest.redirect_uri ||
      oauthRequest.response_type !== "code")
  ) {
    return <div className="p-8">Invalid authorization request.</div>;
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-4">
      <div>
        <h1 className="text-2xl font-bold">Connect Beach House Operations</h1>
        <p className="mt-2 text-sm text-gray-600">
          Sign in with an approved Beach House account to let ChatGPT read live
          booking and operations data.
        </p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={authorize}>
        {!hasSession && (
          <>
            <label className="font-semibold" htmlFor="oauth-phone">
              Phone Number
            </label>
            <input
              id="oauth-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              className="rounded-md px-4 py-2 bg-inherit border"
            />
            <label className="font-semibold" htmlFor="oauth-password">
              Password
            </label>
            <input
              id="oauth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md px-4 py-2 bg-inherit border"
            />
          </>
        )}
        <LoadingButton
          type="submit"
          loading={loading}
          className="bg-green-700 rounded-md px-4 py-2 text-white mt-2"
        >
          {hasSession ? "Authorize ChatGPT" : "Sign in and authorize"}
        </LoadingButton>
        {hasSession && (
          <button
            type="button"
            disabled={loading}
            onClick={switchAccount}
            className="text-sm underline disabled:opacity-50"
          >
            Use another Beach House account
          </button>
        )}
        {errorMessage && (
          <p role="alert" className="text-sm text-error">
            {errorMessage}
          </p>
        )}
      </form>
      <p className="text-xs text-gray-500">
        Only Nathik, Rafica, and Nishtar are authorized. You can disconnect the
        account from ChatGPT settings at any time.
      </p>
    </div>
  );
};

OAuthAuthorize.useNoLayout = true;
export default OAuthAuthorize;
