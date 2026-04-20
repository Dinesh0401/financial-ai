"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Shield, Sparkles, User2 } from "lucide-react";

import { apiLogin, apiRegister, buildSupabaseOAuthUrl, getSupabaseAuthConfigError } from "@/lib/api";
import { saveSession } from "@/lib/auth";

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabaseConfigError = getSupabaseAuthConfigError();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    if (accessToken) {
      router.replace(`/auth/callback#${hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session =
        mode === "register"
          ? await apiRegister(name, email, password)
          : await apiLogin(email, password);
      saveSession(session);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    const oauthUrl = buildSupabaseOAuthUrl("google", `${window.location.origin}/auth/callback`);
    if (!oauthUrl) {
      setError(supabaseConfigError || "Supabase auth configuration is missing.");
      return;
    }
    window.location.href = oauthUrl;
  }

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
            <Sparkles className="size-3.5 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Finna
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {isLogin
              ? "Sign in to continue to your dashboard."
              : "A minute of setup, then honest numbers."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl sm:p-8">
          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={Boolean(supabaseConfigError)}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleIcon />
            <span>{supabaseConfigError ? "Google sign-in unavailable" : "Continue with Google"}</span>
          </button>

          {supabaseConfigError && (
            <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {supabaseConfigError}
            </p>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/40">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Field
                id="name"
                icon={User2}
                label="Full name"
                type="text"
                value={name}
                onChange={setName}
                placeholder="Your name"
                required
              />
            )}

            <Field
              id="email"
              icon={Mail}
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              required
            />

            <Field
              id="password"
              icon={Lock}
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={setPassword}
              placeholder="Min 8 characters"
              minLength={8}
              required
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-white/40 transition hover:text-emerald-400"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            {error && (
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                "Signing you in…"
              ) : (
                <>
                  {isLogin ? "Sign in" : "Create account"}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/50">
            {isLogin ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode(isLogin ? "register" : "login");
                setError("");
              }}
              className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/35">
          <Shield className="size-3.5" />
          <span>End-to-end private · rule-based pipeline · no ML</span>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  icon: Icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  rightSlot,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-white/60">
        {label}
      </label>
      <div className="flex h-11 items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 transition focus-within:border-emerald-500/50 focus-within:bg-white/10">
        <div className="flex w-10 shrink-0 items-center justify-center text-white/40">
          <Icon className="size-4" />
        </div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          className="h-full w-full bg-transparent pr-3 text-sm text-white outline-none placeholder:text-white/30"
        />
        {rightSlot && <div className="pr-3">{rightSlot}</div>}
      </div>
    </div>
  );
}
