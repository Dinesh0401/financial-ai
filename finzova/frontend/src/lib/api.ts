import type {
  DashboardData,
  GoalPrediction,
  GoalRecord,
  HealthScoreData,
  TransactionSummary,
  UserProfile,
} from "@/lib/types";
export { isAuthenticated } from "@/lib/auth";
import { clearSession, getRefreshToken, saveSession, type AuthSession } from "@/lib/auth";

export type UpdateProfilePayload = {
  name?: string;
  monthly_income?: number | null;
  tax_regime?: "old" | "new";
  onboarding_done?: boolean;
};

type ApiErrorPayload = {
  detail?: string;
  title?: string;
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:8000";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

export function hasSupabaseAuthConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseAuthConfigError(): string | null {
  if (hasSupabaseAuthConfig()) {
    return null;
  }
  return "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable Google sign-in.";
}

export function buildSupabaseOAuthUrl(
  provider: string,
  redirectTo: string,
): string | null {
  if (!hasSupabaseAuthConfig()) {
    return null;
  }
  return `${SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
}

export async function exchangeSupabaseCodeForSession(
  code: string,
  codeVerifier: string,
) {
  if (!hasSupabaseAuthConfig()) {
    throw new Error(
      getSupabaseAuthConfigError() || "Supabase auth configuration is missing.",
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=pkce`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        auth_code: code,
        code_verifier: codeVerifier,
      }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(
      payload.detail || payload.title || "Supabase code exchange failed.",
    );
  }

  return response.json();
}

function getAuthHeaders(
  accessToken?: string | null,
  options: { includeJsonContentType?: boolean } = {},
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (options.includeJsonContentType !== false) {
    headers["Content-Type"] = "application/json";
  }

  const token =
    accessToken ??
    (typeof window !== "undefined"
      ? localStorage.getItem("finzova_access_token")
      : null);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(
      payload.detail ||
        payload.title ||
        `Request failed with status ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

async function refreshSessionOrThrow(): Promise<AuthSession> {
  const handleExpiredSession = () => {
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  };

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    handleExpiredSession();
    throw new Error("Your session expired. Please sign in again.");
  }

  try {
    const session = await apiRefreshToken(refreshToken);
    saveSession(session);
    return session;
  } catch {
    handleExpiredSession();
    throw new Error("Your session expired. Please sign in again.");
  }
}

async function performRequest(
  path: string,
  init: RequestInit = {},
  options: { allowRefresh?: boolean; includeJsonContentType?: boolean } = {},
): Promise<Response> {
  const { allowRefresh = true, includeJsonContentType = true } = options;

  const send = (accessToken?: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        ...getAuthHeaders(accessToken, { includeJsonContentType }),
        ...(init.headers ?? {}),
      },
    });

  let response = await send();
  if (response.status !== 401 || !allowRefresh) {
    return response;
  }

  const session = await refreshSessionOrThrow();
  response = await send(session.access_token);
  return response;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await performRequest(path, init);
  return parseResponse<T>(response);
}

export async function getHealthStatus(): Promise<"online" | "offline"> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    return response.ok ? "online" : "offline";
  } catch {
    return "offline";
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  return requestJson<DashboardData>("/v1/dashboard");
}

export async function getHealthScore(): Promise<HealthScoreData> {
  return requestJson<HealthScoreData>("/v1/analysis/health-score");
}

export async function getGoals(): Promise<GoalRecord[]> {
  const response = await requestJson<{ goals: GoalRecord[] }>("/v1/goals");
  return response.goals;
}

export async function getGoalPrediction(goalId: string): Promise<GoalPrediction> {
  return requestJson<GoalPrediction>(`/v1/goals/${goalId}/prediction`);
}

export async function getTransactionSummary(): Promise<TransactionSummary> {
  return requestJson<TransactionSummary>(
    "/v1/transactions/summary?period=monthly&months=6",
  );
}

export async function getCurrentUserProfile(): Promise<UserProfile> {
  return requestJson<UserProfile>("/v1/auth/me");
}

export const getCurrentUser = getCurrentUserProfile;

export async function updateCurrentUserProfile(
  payload: UpdateProfilePayload,
): Promise<UserProfile> {
  return requestJson<UserProfile>("/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export const updateCurrentUser = updateCurrentUserProfile;

export async function apiRegister(
  name: string,
  email: string,
  password: string,
) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return parseResponse<AuthSession>(response);
}

export async function apiLogin(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse<AuthSession>(response);
}

export async function apiRefreshToken(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return parseResponse<AuthSession>(response);
}

function normalizeUploadSource(file: File, source?: string): string {
  if (source && ["bank_csv", "upi_statement", "manual"].includes(source)) {
    return source;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    return "upi_statement";
  }
  return "bank_csv";
}

export async function uploadTransactions(
  file: File,
  source?: string,
  pdfPassword?: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source", normalizeUploadSource(file, source));
  if (pdfPassword?.trim()) {
    formData.append("pdf_password", pdfPassword.trim());
  }

  const response = await performRequest("/v1/transactions/upload", {
    method: "POST",
    body: formData,
  }, { includeJsonContentType: false });
  return parseResponse<{
    total_parsed: number;
    successful: number;
    failed: number;
    failures: { row: number; reason: string }[];
    categories_assigned: Record<string, number>;
  }>(response);
}

export async function createGoal(payload: {
  goal_type: string;
  title: string;
  target_amount: number;
  timeline_months: number;
  current_amount?: number;
}) {
  return requestJson<{
    goal: GoalRecord;
    monthly_required: number;
    success_probability: number;
    simulation: Record<string, unknown>;
  }>("/v1/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteGoal(goalId: string): Promise<void> {
  const response = await performRequest(`/v1/goals/${goalId}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete goal (${response.status})`);
  }
}

export async function fetchWithAuth<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export type OnboardingSnapshotApi = {
  income: number;
  expenses: Record<string, number>;
  loans: {
    type: string;
    name?: string;
    balance: number;
    emi: number;
    interest: number;
  }[];
  goals: {
    type: string;
    name?: string;
    targetAmount: number;
    years: number;
    priority?: "high" | "medium" | "low";
  }[];
  savedAt?: string;
};

export async function getOnboardingSnapshotApi(): Promise<OnboardingSnapshotApi | null> {
  try {
    const resp = await requestJson<{
      snapshot: OnboardingSnapshotApi | null;
      saved_at: string | null;
    }>("/v1/onboarding/snapshot");
    return resp.snapshot ?? null;
  } catch {
    return null;
  }
}

export async function saveOnboardingSnapshotApi(
  snapshot: Omit<OnboardingSnapshotApi, "savedAt">,
): Promise<OnboardingSnapshotApi | null> {
  const resp = await requestJson<{
    snapshot: OnboardingSnapshotApi | null;
    saved_at: string | null;
  }>("/v1/onboarding/snapshot", {
    method: "POST",
    body: JSON.stringify(snapshot),
  });
  return resp.snapshot ?? null;
}
