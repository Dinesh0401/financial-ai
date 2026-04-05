"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2 } from "lucide-react";

import { saveSession } from "@/lib/auth";

/**
 * OAuth callback page.
 *
 * After Google sign-in, Supabase redirects here with tokens in the URL hash:
 *   /auth/callback#access_token=...&refresh_token=...&token_type=bearer&...
 *
 * We extract the tokens, decode user info from the JWT, save the session,
 * and redirect to the dashboard. No backend call needed here.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    function handleCallback() {
      try {
        // Extract tokens from URL hash fragment
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token") || "";

        if (!accessToken) {
          throw new Error("No authentication tokens received. Please try signing in again.");
        }

        // Decode user info directly from the Supabase JWT
        let user = { id: "", email: "", name: null as string | null };
        try {
          const payload = JSON.parse(atob(accessToken.split(".")[1]));
          user = {
            id: payload.sub || "",
            email: payload.email || "",
            name: payload.user_metadata?.full_name || payload.user_metadata?.name || null,
          };
        } catch {
          // Use empty user if JWT decode fails
        }

        saveSession({
          access_token: accessToken,
          refresh_token: refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        });

        router.push("/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed");
        setTimeout(() => router.push("/login"), 3000);
      }
    }

    handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-red-300">
              {error}
            </div>
            <p className="text-xs text-muted-foreground">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <div className="flex items-center justify-center gap-2">
              <Brain className="size-4 text-primary" />
              <p className="text-sm text-muted-foreground">Authenticating...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
