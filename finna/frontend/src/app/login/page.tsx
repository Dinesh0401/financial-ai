"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Shield, Sparkles, User2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { apiLogin, apiRegister, buildSupabaseOAuthUrl, getSupabaseAuthConfigError } from "@/lib/api";
import { saveSession } from "@/lib/auth";

gsap.registerPlugin(useGSAP);

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
      let session;
      if (mode === "register") {
        session = await apiRegister(name, email, password);
      } else {
        session = await apiLogin(email, password);
      }
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

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!rootRef.current) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      const brand = rootRef.current.querySelector("[data-animate='brand']");
      const headline = rootRef.current.querySelector("[data-animate='headline']");
      const sub = rootRef.current.querySelector("[data-animate='sub']");
      const card = rootRef.current.querySelector("[data-animate='card']");
      const foot = rootRef.current.querySelector("[data-animate='foot']");

      if (brand) tl.fromTo(brand, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.5 });
      if (headline) tl.fromTo(headline, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.65 }, "-=0.25");
      if (sub) tl.fromTo(sub, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5 }, "-=0.4");
      if (card) tl.fromTo(card, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.35");
      if (foot) tl.fromTo(foot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, "-=0.25");
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      if (!fieldsRef.current) return;
      gsap.fromTo(
        fieldsRef.current.querySelectorAll("[data-field]"),
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.05, ease: "power2.out" },
      );
    },
    { dependencies: [mode], scope: fieldsRef },
  );

  const isLogin = mode === "login";

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050607] px-4 py-12"
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(ellipse 800px 500px at 20% -10%, rgba(16,185,129,0.15), transparent 60%), radial-gradient(ellipse 700px 400px at 85% 110%, rgba(20,184,166,0.10), transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Brand */}
        <div data-animate="brand" className="mb-7 flex justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/8 bg-white/[0.03] px-3.5 py-1.5 backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Finna
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
              Financial Copilot
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1
          data-animate="headline"
          className="text-center text-4xl font-semibold tracking-tight text-white sm:text-[44px] sm:leading-[1.05]"
        >
          {isLogin ? "Welcome back" : "Get started"}
        </h1>
        <p data-animate="sub" className="mx-auto mt-3 max-w-[340px] text-center text-[14px] leading-relaxed text-white/50">
          {isLogin
            ? "Sign in to see your snapshot, goals and next-best actions."
            : "A minute of setup, then honest numbers — no fluff, no ML guesswork."}
        </p>

        {/* Card */}
        <div
          ref={cardRef}
          data-animate="card"
          className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0a0d0c]/80 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-7"
        >
          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={Boolean(supabaseConfigError)}
            className="group/g relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] font-medium text-white transition-all hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleIcon />
            <span>{supabaseConfigError ? "Google sign-in unavailable" : "Continue with Google"}</span>
            <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent transition-transform duration-700 group-hover/g:translate-x-[300%]" />
          </button>

          {supabaseConfigError && (
            <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3.5 py-2 text-[12px] text-amber-200/90">
              {supabaseConfigError}
            </div>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div ref={fieldsRef} className="space-y-4">
              {!isLogin && (
                <Field
                  key="name"
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
                key="email"
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
                key="password"
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
                    className="text-white/35 transition-colors hover:text-emerald-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            </div>

            {error && (
              <div
                data-field
                className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3.5 py-2 text-[13px] text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group/s relative mt-1 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-white px-5 text-[14px] font-semibold text-black transition-all hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center gap-2">
                {loading ? (
                  <>
                    <Sparkles className="size-4 animate-pulse" />
                    Signing you in…
                  </>
                ) : (
                  <>
                    {isLogin ? "Sign in with email" : "Create account"}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover/s:translate-x-1" />
                  </>
                )}
              </span>
            </button>

            <p className="pt-1 text-center text-[13px] text-white/50">
              {isLogin ? "New to Finna? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => { setMode(isLogin ? "register" : "login"); setError(""); }}
                className="font-medium text-emerald-300 underline-offset-4 transition-colors hover:text-emerald-200 hover:underline"
              >
                {isLogin ? "Create an account" : "Sign in"}
              </button>
            </p>
          </form>
        </div>

        {/* Footer strip */}
        <div
          data-animate="foot"
          className="mt-6 flex flex-col items-center gap-2 text-center"
        >
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <Shield className="size-3.5" />
            <span>End-to-end private · your data stays in your account</span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/25">
            Rule-based pipeline · no ML guesswork
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Field ---------- */

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
    <div data-field className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[11px] font-medium text-white/55"
      >
        {label}
      </label>
      <div className="group/f relative flex h-11 items-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] transition-all focus-within:border-emerald-400/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.08)]">
        <div className="flex size-10 shrink-0 items-center justify-center text-white/30 transition-colors group-focus-within/f:text-emerald-300">
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
          className="h-full w-full bg-transparent pr-3 text-[14px] text-white outline-none placeholder:text-white/25"
        />
        {rightSlot && <div className="pr-3">{rightSlot}</div>}
      </div>
    </div>
  );
}
