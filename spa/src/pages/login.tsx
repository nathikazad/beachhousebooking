import LoadingButton from "@/components/ui/LoadingButton";
import { toIndianAuthPhone } from "@/utils/lib/indianPhone";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";

const Login = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const authPhone = toIndianAuthPhone(phone);
    if (!authPhone) {
      setErrorMessage("Enter a valid 10-digit Indian mobile number");
      return;
    }
    if (!password) {
      setErrorMessage("Enter your password");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        phone: authPhone,
        password,
      });

      if (error) {
        setErrorMessage("Incorrect phone number or password");
        return;
      }

      await router.push("/protected/logs");
    } catch {
      setErrorMessage("Incorrect phone number or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2">
      <form
        className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground"
        onSubmit={login}
      >
        <label className="text-md label-text font-semibold" htmlFor="phone">
          Phone Number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="10-digit mobile number"
          maxLength={10}
          value={phone}
          onChange={(event) =>
            setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
          }
          className="rounded-md px-4 py-2 bg-inherit border"
        />

        <label
          className="text-md label-text font-semibold mt-2"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-md px-4 py-2 bg-inherit border mb-4"
        />

        <LoadingButton
          type="submit"
          loading={loading}
          className="bg-green-700 rounded-md px-4 py-2 text-white"
        >
          Login
        </LoadingButton>
        <span
          role="alert"
          className={`${errorMessage ? "visible" : "invisible"} text-xs text-error`}
        >
          {errorMessage ?? "Authentication error"}
        </span>
      </form>
    </div>
  );
};

Login.useNoLayout = true;
export default Login;
