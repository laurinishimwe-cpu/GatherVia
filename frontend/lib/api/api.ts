import {
  getAuthToken,
  invalidateAuthSession,
  persistAuthSession,
  readAuthSession,
  readCachedAuthUser,
} from "@/lib/session/auth-session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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
  expires_in?: number;
}

let refreshPromise: Promise<string> | null = null;

async function refreshStoredAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const legacyAccessToken = getAuthToken();
    let response: Response;
    try {
      response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh",
          legacy_access_token: legacyAccessToken || undefined,
        }),
        cache: "no-store",
      });
    } catch {
      throw new ApiError("GatherVia is temporarily unreachable. Please try again.", 0);
    }
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const payload = (await response.json()) as { detail?: unknown };
        if (typeof payload.detail === "string") detail = payload.detail;
      } catch {}
      if (response.status === 401) invalidateAuthSession();
      throw new ApiError(detail, response.status);
    }
    const tokens = (await response.json()) as RefreshResponse;
    const user = readAuthSession()?.user ?? readCachedAuthUser();
    if (user) {
      persistAuthSession({
        accessToken: tokens.access_token,
        expiresIn: tokens.expires_in,
        user,
      });
    }
    return tokens.access_token;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
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
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: requestHeaders,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  };

  let response = await performFetch();

  if (response.status === 401 && auth) {
    await refreshStoredAccessToken();
    response = await performFetch();
  }

  // ── Handle non‑2xx responses ─────────────────────
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      } else if (Array.isArray(payload.detail)) {
        detail = payload.detail
          .map((error: unknown) => {
            if (error && typeof error === "object") {
              const item = error as { msg?: unknown; message?: unknown };
              if (typeof item.msg === "string") return item.msg;
              if (typeof item.message === "string") return item.message;
            }
            return JSON.stringify(error);
          })
          .join(", ");
      }
    } catch {}
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function blobHandler(
  path: string,
  options: HandlerOptions = {},
): Promise<Blob> {
  const { auth = true, json, headers, ...rest } = options;
  const performFetch = async (): Promise<Response> => {
    const requestHeaders = new Headers(headers);
    if (json !== undefined) requestHeaders.set("Content-Type", "application/json");
    if (auth) {
      const token = getAuthToken();
      if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
    }
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: requestHeaders,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  };
  let response = await performFetch();
  if (response.status === 401 && auth) {
    await refreshStoredAccessToken();
    response = await performFetch();
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {}
    throw new ApiError(detail, response.status);
  }
  return response.blob();
}

export function resolveAssetUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}
