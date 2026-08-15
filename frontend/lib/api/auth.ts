import { ApiError, handler } from "@/lib/api/api";
import { getAuthToken } from "@/lib/session/auth-session";
import type {
  AuthSession,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  SSOAssertionPayload,
  SupportedLanguage,
} from "@/lib/types/auth";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

type SessionAction = "login" | "register" | "google" | "microsoft" | "refresh" | "logout";

async function sessionRequest<T>(
  action: SessionAction,
  payload?: unknown,
  legacyAccessToken?: string | null,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        payload,
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
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {}
    throw new ApiError(detail, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function exchangeToken(
  action: Extract<SessionAction, "login" | "register" | "google" | "microsoft">,
  payload: LoginPayload | RegisterPayload | SSOAssertionPayload,
): Promise<AuthSession> {
  const tokenResponse = await sessionRequest<TokenResponse>(action, payload);

  const user = await handler<AuthUser>("/api/v1/auth/me", {
    auth: false,
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`,
    },
  });

  return {
    accessToken: tokenResponse.access_token,
    expiresIn: tokenResponse.expires_in,
    user,
  };
}

export function registerUser(payload: RegisterPayload): Promise<AuthSession> {
  return exchangeToken("register", payload);
}

export function loginUser(payload: LoginPayload): Promise<AuthSession> {
  return exchangeToken("login", payload);
}

export function loginWithGoogle(payload: SSOAssertionPayload): Promise<AuthSession> {
  return exchangeToken("google", payload);
}

export function loginWithMicrosoft(
  payload: SSOAssertionPayload,
): Promise<AuthSession> {
  return exchangeToken("microsoft", payload);
}

export function updateCurrentUserLanguage(
  language: SupportedLanguage,
): Promise<AuthUser> {
  return handler<AuthUser>("/api/v1/auth/me/language", {
    method: "PATCH",
    json: { language },
  });
}

export function fetchCurrentUser(): Promise<AuthUser> {
  const token = getAuthToken();
  
  return handler<AuthUser>("/api/v1/auth/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function refreshAuthSession(): Promise<AuthSession> {
  const tokenResponse = await sessionRequest<TokenResponse>(
    "refresh",
    undefined,
    getAuthToken(),
  );

  const user = await handler<AuthUser>("/api/v1/auth/me", {
    auth: false,
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`,
    },
  });

  return {
    accessToken: tokenResponse.access_token,
    expiresIn: tokenResponse.expires_in,
    user,
  };
}

export function logoutAuthSession(): Promise<void> {
  return sessionRequest<void>("logout");
}
