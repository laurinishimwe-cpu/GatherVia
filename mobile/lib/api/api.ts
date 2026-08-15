import {
  getAuthToken,
  getInstallationId,
  getRefreshToken,
  invalidateAuthSession,
  updateAuthTokens,
} from "@/lib/session/auth-session";

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://gathervia.onrender.com"
).replace(/\/$/, "");

export interface HandlerOptions extends RequestInit {
  auth?: boolean;
  json?: unknown;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RefreshResponse {
  access_token: string;
  refresh_token?: string | null;
}

let refreshPromise: Promise<string> | null = null;

function readErrorDetail(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const { detail, message } = payload as {
    detail?: unknown;
    message?: unknown;
  };

  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const validationMessage = (item as { msg?: unknown }).msg;
          return typeof validationMessage === "string" ? validationMessage : "";
        }
        return "";
      })
      .filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const [refreshToken, installationId] = await Promise.all([
      getRefreshToken(),
      getInstallationId(),
    ]);
    const legacyAccessToken = getAuthToken();
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Client-Platform": "mobile",
      "X-Installation-ID": installationId,
    });
    if (!refreshToken && legacyAccessToken) {
      headers.set("Authorization", `Bearer ${legacyAccessToken}`);
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers,
        body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
      });
    } catch {
      throw new ApiError("Cannot reach GatherVia. Check your connection and try again.", 0);
    }

    if (!response.ok) {
      let detail = response.statusText;
      try {
        detail = readErrorDetail(await response.json(), detail);
      } catch {}
      if (response.status === 401) await invalidateAuthSession();
      throw new ApiError(detail, response.status);
    }

    const tokens = (await response.json()) as RefreshResponse;
    await updateAuthTokens(tokens.access_token, tokens.refresh_token);
    return tokens.access_token;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export function renewAuthToken(): Promise<string> {
  return refreshAccessToken();
}

export async function handler<T>(
  path: string,
  options: HandlerOptions = {},
): Promise<T> {
  const { auth = true, json, headers, ...rest } = options;
  const performFetch = async (): Promise<Response> => {
    const requestHeaders = new Headers(headers);
    if (json !== undefined) requestHeaders.set("Content-Type", "application/json");
    if (auth) {
      const token = getAuthToken();
      if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
    }
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers: requestHeaders,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });
    } catch {
      throw new ApiError(
        "Cannot reach GatherVia. Check your internet connection first. If other apps work, temporarily turn off Private DNS, VPN, or ad blocking and try again.",
        0,
      );
    }
  };

  let response = await performFetch();
  if (response.status === 401 && auth) {
    await refreshAccessToken();
    response = await performFetch();
  }

  // ── Handle non‑2xx responses ─────────────────────
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = readErrorDetail(payload, detail);
    } catch {}
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function resolveAssetUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
