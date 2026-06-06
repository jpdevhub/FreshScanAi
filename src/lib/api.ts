import toast from 'react-hot-toast';
import type {
  ScanResult,
  HistoryScan,
  HistoryStats,
  Market,
  UserProfile,
} from './types';

// Base URL — override with VITE_API_URL in .env for production
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000';

// ── Token management ──────────────────────────────────────────────────────────

const TOKEN_KEY = 'fs_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event('auth-change'));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('auth-change'));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Shared Error Handling Logic ──────────────────────────────────────────────

async function handleResponse(res: Response): Promise<Response> {
  if (res.ok) return res;

  if (res.status >= 500) {
    const msg = "Server error. Please try again later.";
    toast.error(msg);
    throw new Error(msg);
  }

  const err = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(input, init);
    return await handleResponse(res);
  } catch (error) {
    if (error instanceof TypeError) {
      toast.error("Unable to connect to the server. Please check your internet connection.");
    }
    console.error("API Error:", error);
    throw error;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const validRes = await safeFetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers as Record<string, string> || {}),
    },
  });
  return validRes.json() as Promise<T>;
}

// ── Response envelopes ────────────────────────────────────────────────────────

export interface ScanResponse    { success: boolean; scan: ScanResult; }
export interface HistoryResponse { success: boolean; count: number; stats: HistoryStats; scans: HistoryScan[]; }
export interface MarketsResponse { success: boolean; markets: Market[]; }
export interface GradcamResponse { gradcam_image: string; predicted_class: string; class_index: number; mode: 'real' | 'demo'; }

// Metadata sent alongside edge-inference results so the backend can store them
// without re-running the ML pipeline on the server.
export interface EdgeInferenceMeta {
  freshness_label?: string;
  fused_score?:     number;
  source?:          'edge_onnx' | 'server';
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  loginUrl: (): string => `${API_BASE}/api/v1/auth/login/google`,

  getMe: (): Promise<UserProfile> => apiFetch<UserProfile>('/api/v1/auth/me'),

  // ── Scans ────────────────────────────────────────────────────────────────
  // meta is optional — when provided (edge inference path), the backend skips
  // running its own ML pipeline and just stores the result we computed locally.
  submitScan: async (blob: Blob, meta?: EdgeInferenceMeta): Promise<ScanResponse> => {
    const form = new FormData();
    form.append('image', blob, 'scan.jpg');

    // Attach edge inference metadata if available
    if (meta?.freshness_label) form.append('freshness_label', meta.freshness_label);
    if (meta?.fused_score !== undefined) form.append('fused_score', String(meta.fused_score));
    if (meta?.source) form.append('source', meta.source);

    const validRes = await safeFetch(`${API_BASE}/api/v1/scan-auto`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });

    return validRes.json() as Promise<ScanResponse>;
  },

  /**
   * Try the HF backend with a single image (same as submitScan with no meta).
   * Returns null silently on network errors so callers can fall back to ONNX
   * without showing an error toast.
   * Throws on 4xx/5xx server errors (e.g. NOT_A_FISH from backend).
   */
  scanOnline: async (blob: Blob): Promise<ScanResponse | null> => {
    const form = new FormData();
    form.append('image', blob, 'scan.jpg');
    try {
      const res = await fetch(`${API_BASE}/api/v1/scan-auto`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      return res.json() as Promise<ScanResponse>;
    } catch (err) {
      if (err instanceof TypeError) {
        // Network offline — silent fallback to ONNX
        return null;
      }
      throw err; // Server error (e.g. NOT_A_FISH) — propagate
    }
  },

  getLatestScan: (): Promise<ScanResponse> =>
    apiFetch<ScanResponse>('/api/v1/scans/latest'),

  getScan: (id: string): Promise<ScanResponse> =>
    apiFetch<ScanResponse>(`/api/v1/scans/${id}`),

  getScanHistory: (limit = 20, offset = 0): Promise<HistoryResponse> =>
    apiFetch<HistoryResponse>(`/api/v1/scans/history?limit=${limit}&offset=${offset}`),

  // ── Grad-CAM ─────────────────────────────────────────────────────────────
  getGradcam: async (blob: Blob): Promise<GradcamResponse> => {
    const form = new FormData();
    form.append('image', blob, 'gradcam_input.jpg');

    const validRes = await safeFetch(`${API_BASE}/api/v1/gradcam`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });

    return validRes.json() as Promise<GradcamResponse>;
  },

  getMarkets: (): Promise<MarketsResponse> =>
    apiFetch<MarketsResponse>('/api/v1/maps/markets'),
};
