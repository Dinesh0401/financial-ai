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
  const [remember, setRemember] = useState(true);
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
  const leftRef = useRef<HTMLDivElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!leftRef.current) return;

      const meteors = leftRef.current.querySelectorAll("[data-meteor]");
      const orbs = leftRef.current.querySelectorAll("[data-orb]");
      const heading = leftRef.current.querySelector("[data-anim='heading']");
      const tag = leftRef.current.querySelector("[data-anim='tag']");
      const stats = leftRef.current.querySelectorAll("[data-anim='stat']");

      gsap.set(meteors, { autoAlpha: 0, x: -80, y: 80 });
      gsap.to(meteors, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        duration: 1.1,
        stagger: 0.08,
        ease: "power3.out",
      });
      gsap.to(meteors, {
        x: "+=30",
        y: "-=20",
        duration: 7,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: { each: 0.6, from: "random" },
        delay: 1.1,
      });

      gsap.to(orbs, {
        scale: 1.15,
        duration: 5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.8,
      });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (heading) tl.fromTo(heading, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.2);
      if (tag) tl.fromTo(tag, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.4");
      if (stats.length) tl.fromTo(stats, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, "-=0.35");
    },
    { scope: leftRef },
  );

  useGSAP(
    () => {
      if (!rootRef.current) return;
      const right = rootRef.current.querySelector("[data-right]");
      if (right) {
        gsap.fromTo(
          right.querySelectorAll("[data-reveal]"),
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", delay: 0.25 },
        );
      }
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
      className="relative flex min-h-screen items-stretch bg-[#050607] text-white"
    >
      {/* ============ LEFT BRAND PANEL ============ */}
      <div
        ref={leftRef}
        className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:justify-between"
        style={{
          background:
            "linear-gradient(135deg, #0c3a2f 0%, #10b981 45%, #14b8a6 75%, #0ea5a0 100%)",
        }}
      >
        {/* Meteor shapes */}
        <div className="pointer-events-none absolute inset-0">
          {/* Bottom cluster — meteors tilted ~45deg */}
          <div
            data-meteor
            className="absolute -bottom-10 left-8 h-32 w-[360px] rotate-[38deg] rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, #fbbf24 30%, #f97316 70%, transparent)",
              filter: "blur(1px)",
              opacity: 0.85,
            }}
          />
          <div
            data-meteor
            className="absolute bottom-20 -left-6 h-20 w-[240px] rotate-[38deg] rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, #fde68a 30%, #fb923c 75%, transparent)",
              filter: "blur(0.5px)",
              opacity: 0.9,
            }}
          />
          <div
            data-meteor
            className="absolute bottom-40 left-24 h-10 w-[180px] rotate-[38deg] rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, #ffffff 40%, #fb923c 80%, transparent)",
              opacity: 0.7,
            }}
          />
          <div
            data-meteor
            className="absolute bottom-16 left-[38%] h-12 w-[220px] rotate-[38deg] rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, #fcd34d 40%, #f59e0b 80%, transparent)",
              opacity: 0.6,
              filter: "blur(0.5px)",
            }}
          />
          <div
            data-meteor
            className="absolute bottom-6 left-[52%] h-24 w-[280px] rotate-[38deg] rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, #fb923c 30%, #ef4444 70%, transparent)",
              opacity: 0.75,
              filter: "blur(1px)",
            }}
          />
          <div
            data-meteor
            className="absolute top-16 right-10 h-8 w-[160px] rotate-[38deg] rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, #ffffff 40%, #a7f3d0 80%, transparent)",
              opacity: 0.5,
            }}
          />
          <div
            data-meteor
            className="absolute top-32 right-32 h-6 w-[120px] rotate-[38deg] rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, #ffffff 40%, transparent)",
              opacity: 0.4,
            }}
          />

          {/* Glow orbs */}
          <div
            data-orb
            className="absolute -top-24 -left-24 size-[320px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.18), transparent 60%)" }}
          />
          <div
            data-orb
            className="absolute -bottom-40 -right-20 size-[380px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(16,185,129,0.35), transparent 65%)" }}
          />

          {/* Subtle grain via layered radial */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at top left, rgba(255,255,255,0.1), transparent 50%)",
              mixBlendMode: "overlay",
            }}
          />
        </div>

        {/* Top brand row */}
        <div className="relative z-10 p-10">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
              Finna
            </span>
          </div>
        </div>

        {/* Middle content */}
        <div className="relative z-10 px-10 pb-4">
          <h2
            data-anim="heading"
            className="text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
            style={{ fontSize: "clamp(2.5rem, 4vw, 3.75rem)", fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.02em" }}
          >
            Welcome to <br />
            your future<br />
            money saver.
          </h2>
          <p
            data-anim="tag"
            className="mt-5 max-w-md text-[15px] leading-relaxed text-white/85"
          >
            Finna is your India-first financial copilot. Track spending, crush debt,
            and hit goals with honest, deterministic insights — not ML guesswork.
          </p>

          <div className="mt-8 grid max-w-md grid-cols-3 gap-4">
            {[
              { k: "24", v: "Expense categories" },
              { k: "6", v: "Analysis modules" },
              { k: "₹0", v: "Data leaves you" },
            ].map((s) => (
              <div
                key={s.v}
                data-anim="stat"
                className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-md"
              >
                <div className="text-2xl font-semibold text-white">{s.k}</div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/70">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom footer line */}
        <div className="relative z-10 flex items-center justify-between p-10 text-[11px] text-white/70">
          <div className="flex items-center gap-2">
            <Shield className="size-3.5" />
            <span>End-to-end private</span>
          </div>
          <div className="font-medium uppercase tracking-[0.22em]">
            Rule-based · no ML
          </div>
        </div>
      </div>

      {/* ============ RIGHT FORM PANEL ============ */}
      <div
        data-right
        className="relative flex w-full flex-col justify-center bg-[#050607] px-5 py-12 sm:px-10 lg:w-1/2"
      >
        {/* Subtle bg */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-[400px]">
          {/* Mobile brand (shown on small screens) */}
          <div data-reveal className="mb-8 flex justify-center lg:hidden">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5">
              <Sparkles className="size-3.5 text-emerald-300" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
                Finna · Financial Copilot
              </span>
            </div>
          </div>

          {/* Heading */}
          <div data-reveal>
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-white">
              {isLogin ? "Sign in" : "Create your account"}
            </h1>
            <p className="mt-2 text-[14px] text-white/55">
              {isLogin
                ? "Welcome back — pick up where you left off."
                : "A minute of setup, then honest numbers only."}
            </p>
          </div>

          {/* Google */}
          <div data-reveal className="mt-8">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={Boolean(supabaseConfigError)}
              className="group/g relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-[14px] font-medium text-white transition-all hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>

          {/* Divider */}
          <div data-reveal className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
              or with email
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div ref={fieldsRef} className="space-y-3.5">
              {!isLogin && (
                <Field
                  key="name"
                  id="name"
                  icon={User2}
                  type="text"
                  value={name}
                  onChange={setName}
                  placeholder="Full name"
                  required
                />
              )}
              <Field
                key="email"
                id="email"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Email address"
                required
              />
              <Field
                key="password"
                id="password"
                icon={Lock}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Password"
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

            {isLogin && (
              <div data-field className="flex items-center justify-between pt-0.5 text-[13px]">
                <label className="flex cursor-pointer items-center gap-2 text-white/55 hover:text-white/80">
                  <span
                    className={`flex size-4 items-center justify-center rounded-[5px] border transition-all ${
                      remember
                        ? "border-emerald-400 bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                        : "border-white/20 bg-white/[0.03]"
                    }`}
                  >
                    {remember && (
                      <svg viewBox="0 0 12 12" className="size-3 text-black">
                        <path
                          d="M2.5 6.2l2.3 2.3L9.5 3.8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                >
                  Forgot password?
                </button>
              </div>
            )}

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
              className="group/s relative mt-2 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-[14px] font-semibold text-[#04110c] shadow-[0_18px_40px_-18px_rgba(16,185,129,0.7)] transition-all hover:shadow-[0_22px_48px_-16px_rgba(16,185,129,0.9)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center gap-2 uppercase tracking-[0.18em]">
                {loading ? (
                  <>
                    <Sparkles className="size-4 animate-pulse" />
                    Signing in…
                  </>
                ) : (
                  <>
                    {isLogin ? "Login" : "Create account"}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover/s:translate-x-1" />
                  </>
                )}
              </span>
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover/s:translate-x-full" />
            </button>

            <p data-field className="pt-2 text-center text-[13px] text-white/50">
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
      </div>
    </div>
  );
}

/* ---------- Field ---------- */

function Field({
  id,
  icon: Icon,
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
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div data-field>
      <div className="group/f relative flex h-12 items-center overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.02] transition-all focus-within:border-emerald-400/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.08)]">
        <div className="flex size-11 shrink-0 items-center justify-center text-white/30 transition-colors group-focus-within/f:text-emerald-300">
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
          className="h-full w-full bg-transparent pr-4 text-[14px] text-white outline-none placeholder:text-white/30"
        />
        {rightSlot && <div className="pr-4">{rightSlot}</div>}
      </div>
    </div>
  );
}
