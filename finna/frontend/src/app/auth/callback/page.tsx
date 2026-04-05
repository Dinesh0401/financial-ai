"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2 } from "lucide-react";

import { API_BASE_URL } from "@/lib/api";
import { saveSession } from "@/lib/auth";

/**
 * OAuth callback page.
 *
 * After Google sign-in, Supabase redirects here with tokens in the URL hash:
 *   /auth/callback#access_token=...&refresh_token=...&token_type=bearer&...
 *
 * We extract the tokens, call our backend to sync the user profile,
 * then save the session and redirect to the dashboard.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleCallback() {
      try {
        // Extract tokens from URL hash fragment
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken) {
          // Maybe tokens are in query params (some flows)
          const query = new URLSearchParams(window.location.search);
          const code = query.get("code");
          if (code) {
            // Exchange code for session via Supabase token endpoint
            const tokenResponse = await fetch(
              `https://qtndxfbonrzyfzdgnhan.supabase.co/auth/v1/token?grant_type=pkce`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bmR4ZmJvbnJ6eWZ6ZGduaGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzM4MDYsImV4cCI6MjA4OTc0OTgwNn0.3Ykj4hCY7ySUVBL1acEj4tfWmdmkzm9K905lbUyLCgY",
                },
                body: JSON.stringify({
                  auth_code: code,
                  code_verifier: sessionStorage.getItem("code_verifier") || "",
                }),
              }
            );
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              await syncAndRedirect(tokenData.access_token, tokenData.refresh_token);
              return;
            }
          }
          throw new Error("No authentication tokens received. Please try signing in again.");
        }

        await syncAndRedirect(accessToken, refreshToken || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication failed");
        setTimeout(() => router.push("/login"), 3000);
      }
    }

    async function syncAndRedirect(accessToken: string, refreshToken: string) {
      // Call our backend to sync the user profile
      // The backend's get_current_user will verify the token with Supabase
      // and ensure_profile will create/update the local user record
      const profileResponse = await fetch(`${API_BASE_URL}/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      let user = { id: "", email: "", name: null as string | null };

      if (profileResponse.ok) {
        const data = await profileResponse.json();
        user = { id: data.user_id || data.id || "", email: data.email || "", name: data.name || null };
      } else {
        // Fallback: decode the JWT to get basic user info
        try {
          const payload = JSON.parse(atob(accessToken.split(".")[1]));
          user = {
            id: payload.sub || "",
            email: payload.email || "",
            name: payload.user_metadata?.name || null,
          };
        } catch {
          // Use empty user
        }
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
              <p className="text-sm text-muted-foreground">Authenticating and syncing your profile...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
