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
  const formBoxRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!rootRef.current) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      const header = rootRef.current.querySelector("[data-animate='header']");
      const card = rootRef.current.querySelector("[data-animate='card']");
      const info = rootRef.current.querySelector("[data-animate='info']");
      const footer = rootRef.current.querySelector("[data-animate='footer']");
      const orbs = rootRef.current.querySelectorAll("[data-orb]");

      gsap.set(orbs, { autoAlpha: 0, scale: 0.7 });
      gsap.to(orbs, { autoAlpha: 1, scale: 1, duration: 1.4, stagger: 0.15, ease: "power2.out" });
      gsap.to(orbs, {
        x: "+=30",
        y: "+=20",
        duration: 9,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        stagger: { each: 1.5, from: "random" },
      });

      if (header) tl.fromTo(header, { autoAlpha: 0, y: -14 }, { autoAlpha: 1, y: 0, duration: 0.55 });
      if (card) tl.fromTo(card, { autoAlpha: 0, y: 24, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.65, ease: "back.out(1.3)" }, "-=0.25");
      if (info) tl.fromTo(info, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45 }, "-=0.3");
      if (footer) tl.fromTo(footer, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, "-=0.25");
    },
    { scope: rootRef },
  );

  // Animate field block on mode switch
  useGSAP(
    () => {
      if (!formBoxRef.current) return;
      gsap.fromTo(
        formBoxRef.current.querySelectorAll("[data-field]"),
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, ease: "power2.out" },
      );
    },
    { dependencies: [mode], scope: formBoxRef },
  );

  const headline = mode === "login" ? "Welcome back" : "Create your account";
  const subcopy =
    mode === "login"
      ? "Your future money saver. Sign in to pick up where you left off."
      : "Your future money saver. A minute of setup, then honest numbers only.";

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
    >
      {/* Background stack */}
      <div className="pointer-events-none absolute inset-0">
        {/* Soft base gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(45,212,191,0.08),_transparent_60%)]" />
        {/* Grid with radial mask */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 35%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 75%)",
          }}
        />
        {/* Floating orbs */}
        <div data-orb className="absolute -top-24 left-[12%] size-[320px] rounded-full bg-emerald-500/25 blur-[120px]" />
        <div data-orb className="absolute top-1/3 right-[8%] size-[260px] rounded-full bg-teal-400/20 blur-[110px]" />
        <div data-orb className="absolute bottom-[-60px] left-[30%] size-[300px] rounded-full bg-emerald-600/15 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-md space-y-7">
        {/* Brand header */}
        <div data-animate="header" className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 backdrop-blur">
            <Sparkles className="size-3.5 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-emerald-300">
              Finna · Financial Copilot
            </span>
          </div>
          <h1 className="mt-5 bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            {headline}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-white/55">{subcopy}</p>
        </div>

        {/* Card with gradient border */}
        <div
          data-animate="card"
          className="group relative rounded-3xl p-[1px] transition-transform duration-300 hover:-translate-y-0.5"
          style={{
            background:
              "linear-gradient(140deg, rgba(16,185,129,0.55), rgba(16,185,129,0.08) 35%, rgba(45,212,191,0.35) 70%, rgba(16,185,129,0.5))",
          }}
        >
          <div className="rounded-3xl bg-[#060b0a]/95 p-6 backdrop-blur-xl sm:p-7">
            {/* Mode tabs */}
            <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-white/5 bg-white/[0.03] p-1">
              <div
                className="absolute inset-y-1 w-1/2 rounded-lg bg-gradient-to-r from-emerald-500/90 to-teal-500/90 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]"
                style={{ transform: mode === "login" ? "translateX(0%)" : "translateX(100%)" }}
              />
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className={`relative z-10 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  mode === "login" ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); }}
                className={`relative z-10 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  mode === "register" ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                Create account
              </button>
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={Boolean(supabaseConfigError)}
              className="group/btn relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition-all hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
            >
              <GoogleIcon />
              <span>{supabaseConfigError ? "Google sign-in unavailable" : "Continue with Google"}</span>
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
            </button>

            {supabaseConfigError && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                {supabaseConfigError}
              </div>
            )}

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/10" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">
                or with email
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-white/10" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div ref={formBoxRef} className="space-y-4">
                {mode === "register" && (
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
                      className="text-white/40 transition-colors hover:text-emerald-300"
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
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group/submit relative mt-2 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-[#04110c] shadow-[0_18px_40px_-18px_rgba(16,185,129,0.7)] transition-all hover:shadow-[0_22px_50px_-18px_rgba(16,185,129,0.9)] disabled:opacity-70"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading
                    ? "Processing…"
                    : mode === "login"
                      ? "Sign in with email"
                      : "Create account"}
                  {!loading && (
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover/submit:translate-x-1" />
                  )}
                </span>
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/submit:translate-x-full" />
              </button>
            </form>
          </div>
        </div>

        {/* Pipeline info */}
        <div
          data-animate="info"
          className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/5 p-4 text-center backdrop-blur"
        >
          <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
            <Sparkles className="size-3.5" />
            Rule-based pipeline · no ML model
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/55">
            Expense · Debt · Risk · Goal · Investment · Orchestrator — deterministic scoring on your own numbers.
          </p>
        </div>

        <div
          data-animate="footer"
          className="flex items-center justify-center gap-2 text-[11px] text-white/45"
        >
          <Shield className="size-3.5" />
          <span>End-to-end private. Your financial data stays in your account.</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Field primitive ---------- */

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
        className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45"
      >
        {label}
      </label>
      <div className="group/field relative flex h-12 items-center overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] transition-all focus-within:border-emerald-400/50 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.08)]">
        <div className="flex size-11 shrink-0 items-center justify-center text-white/30 transition-colors group-focus-within/field:text-emerald-300">
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
          className="h-full w-full bg-transparent pr-3 text-sm text-white outline-none placeholder:text-white/25"
        />
        {rightSlot && <div className="pr-3">{rightSlot}</div>}
      </div>
    </div>
  );
}
