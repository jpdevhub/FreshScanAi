import toast from "react-hot-toast";
import type {
  ScanResult,
  HistoryScan,
  HistoryStats,
  Market,
  UserProfile,
} from "./types";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:8000";

const TOKEN_KEY = "fs_access_token";
const REFRESH_KEY = "fs_refresh_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("auth-change"));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event("auth-change"));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: Bearer ${token} } : {};
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(${API_BASE}/api/v1/auth/refresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    window.dispatchEvent(new Event("auth-change"));
    return true;
  } catch {
    return false;
  }
}

type ApiRequestOptions = {
  silent?: boolean;
};

async function handleResponse(
  res: Response,
  options?: ApiRequestOptions,
): Promise<Response> {
  if (res.ok) return res;

  if (res.status >= 500) {
    const msg = "Server error. Please try again later.";
    if (!options?.silent) {
      toast.error(msg);
    }
    throw new Error(msg);
  }
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error((err as { detail?: string }).detail || HTTP ${res.status});
}

async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: ApiRequestOptions,
): Promise<Response> {
  try {
    const res = await fetch(input, init);
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (!refreshed) {
        clearToken();
        window.location.href = "/auth";
        throw new Error("Session expired.");
      }
      const retryRes = await fetch(input, {
        ...init,
        headers: {
          ...((init?.headers as Record<string, string>) || {}),
          ...authHeaders(),
        },
      });
      return await handleResponse(retryRes, options);
    }
    return await handleResponse(res, options);
  } catch (error) {
    if (error instanceof TypeError && !options?.silent) {
      toast.error(
        "Unable to connect to the server. Please check your internet connection.",
      );
    }
    console.error("API Error:", error);
    throw error;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const validRes = await safeFetch(${API_BASE}${path}, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  return validRes.json() as Promise<T>;
}

export interface ScanResponse {
  success: boolean;
  scan: ScanResult;
}
export interface HistoryResponse {
  success: boolean;
  count: number;
  stats: HistoryStats;
  scans: HistoryScan[];
}
export interface MarketsResponse {
  success: boolean;
  markets: Market[];
}
export interface GradcamResponse {
  gradcam_image: string;
  predicted_class: string;
  class_index: number;
  mode: "real" | "demo";
}

export interface EdgeInferenceMeta {
  freshness_label?: string;
  fused_score?: number;
  source?: "edge_onnx" | "server";
}

export const api = {
  loginUrl: async (turnstileToken?: string): Promise<string> => {
    if (turnstileToken) {
      const response = await apiFetch<{ redirect_url: string }>(
        "/api/v1/auth/login/google",
        {
          method: "POST",
          body: JSON.stringify({ turnstile_token: turnstileToken }),
        },
      );
      return response.redirect_url;
    }
    return ${API_BASE}/api/v1/auth/login/google;
  },

  getMe: (): Promise<UserProfile> => apiFetch<UserProfile>("/api/v1/auth/me"),

  submitScan: async (
    blob: Blob,
    meta?: EdgeInferenceMeta,
    options?: ApiRequestOptions,
  ): Promise<ScanResponse> => {
    const form = new FormData();
    form.append("image", blob, "scan.jpg");

    if (meta?.freshness_label)
      form.append("freshness_label", meta.freshness_label);
    if (meta?.fused_score !== undefined)
      form.append("fused_score", String(meta.fused_score));
    if (meta?.source) form.append("source", meta.source);

    const validRes = await safeFetch(
      ${API_BASE}/api/v1/scan-auto,
      {
        method: "POST",
        headers: authHeaders(),
        body: form,
      },
      options,
    );
    return validRes.json() as Promise<ScanResponse>;
  },

  scanOnline: async (blob: Blob): Promise<ScanResponse | null> => {
    const form = new FormData();
    form.append("image", blob, "scan.jpg");
    try {
      const res = await fetch(${API_BASE}/api/v1/scan-auto, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(
          (err as { detail?: string }).detail || HTTP ${res.status},
        );
      }
      return res.json() as Promise<ScanResponse>;
    } catch (err) {
      if (err instanceof TypeError) {
        return null;
      }
      throw err;
    }
  },

  getLatestScan: (): Promise<ScanResponse> =>
    apiFetch<ScanResponse>("/api/v1/scans/latest"),

  getScan: (id: string): Promise<ScanResponse> =>
    apiFetch<ScanResponse>(/api/v1/scans/${id}),

  getScanHistory: (limit = 20, offset = 0): Promise<HistoryResponse> =>
    apiFetch<HistoryResponse>(
      /api/v1/scans/history?limit=${limit}&offset=${offset},
    ),

  getGradcam: async (blob: Blob): Promise<GradcamResponse> => {
    const form = new FormData();
    form.append("image", blob, "gradcam_input.jpg");
    const validRes = await safeFetch(${API_BASE}/api/v1/gradcam, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    return validRes.json() as Promise<GradcamResponse>;
  },

  getMarkets: (): Promise<MarketsResponse> =>
    apiFetch<MarketsResponse>("/api/v1/maps/markets"),

  getLiveMarkets: (
    lat: number,
    lng: number,
    radius = 15000,
  ): Promise<MarketsResponse> =>
    apiFetch<MarketsResponse>(
      /api/v1/maps/markets/live?lat=${lat}&lng=${lng}&radius=${radius},
    ),
};