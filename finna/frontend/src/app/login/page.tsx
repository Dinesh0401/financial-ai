"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Brain, Eye, EyeOff, Network, Shield } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { Button } from "@/components/ui/button";

gsap.registerPlugin(useGSAP);
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiLogin, apiRegister, buildSupabaseOAuthUrl, getSupabaseAuthConfigError } from "@/lib/api";
import { saveSession } from "@/lib/auth";

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
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

  // If OAuth tokens landed on /login instead of /auth/callback, handle them here
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    if (accessToken) {
      // Tokens arrived — redirect to the callback page to process them
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

  const loginRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!loginRef.current) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      const header = loginRef.current.querySelector("[data-animate='header']");
      const card = loginRef.current.querySelector("[data-animate='card']");
      const info = loginRef.current.querySelector("[data-animate='info']");
      const footer = loginRef.current.querySelector("[data-animate='footer']");

      if (header) tl.fromTo(header, { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.6 });
      if (card) tl.fromTo(card, { autoAlpha: 0, y: 30, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.2)" }, "-=0.3");
      if (info) tl.fromTo(info, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5 }, "-=0.3");
      if (footer) tl.fromTo(footer, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, "-=0.2");
    },
    { scope: loginRef },
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3" />
      <div ref={loginRef} className="relative w-full max-w-md space-y-8">
        <div data-animate="header" className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Brain className="size-5 text-primary" />
            <p className="text-xs uppercase tracking-[0.42em] text-primary">Financial Assistant</p>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "login"
              ? "Your Future Money Saver. Sign in to access your account."
              : "Your Future Money Saver. Create your account to get started."}
          </p>
        </div>

        <Card data-animate="card" className="border-border/60 bg-card/80 backdrop-blur-xl">
          <CardContent className="p-6">
            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full gap-3 border-border/80 bg-white/5 hover:bg-white/10"
              onClick={handleGoogleSignIn}
              disabled={Boolean(supabaseConfigError)}
            >
              <GoogleIcon />
              {supabaseConfigError ? "Google sign-in unavailable" : "Continue with Google"}
            </Button>
            {supabaseConfigError && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {supabaseConfigError}
              </div>
            )}

            <div className="my-6 flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  "Processing..."
                ) : (
                  <>
                    {mode === "login" ? "Sign in with email" : "Create account"}
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("register"); setError(""); }}
                    className="text-primary hover:underline"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(""); }}
                    className="text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Copilot info card */}
        <div data-animate="info" className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-primary">
            <Network className="size-3.5" />
            <span className="uppercase tracking-wider">Powered by 6 Autonomous AI Agents</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Expense, Debt, Goal, Risk, Investment & Tax agents analyze your finances in real time.
          </p>
        </div>

        <div data-animate="footer" className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="size-3.5" />
          <span>End-to-end encrypted. Your financial data never leaves your control.</span>
        </div>
      </div>
    </div>
  );
}
