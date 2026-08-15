import { handler } from "@/lib/api/api";
import {
  getAuthToken,
  getInstallationId,
  getRefreshToken,
} from "@/lib/session/auth-session";
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
  refresh_token?: string | null;
}

async function exchangeToken(
  path: string,
  payload: LoginPayload | RegisterPayload | SSOAssertionPayload,
): Promise<AuthSession> {
  const installationId = await getInstallationId();
  const tokenResponse = await handler<TokenResponse>(path, {
    method: "POST",
    auth: false,
    json: payload,
    headers: {
      "X-Client-Platform": "mobile",
      "X-Installation-ID": installationId,
    },
  });

  const user = await handler<AuthUser>("/api/v1/auth/me", {
    auth: false,
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`,
    },
  });

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? undefined,
    expiresIn: tokenResponse.expires_in,
    user,
  };
}

export async function refreshAuthSession(): Promise<AuthSession> {
  const [refreshToken, installationId] = await Promise.all([
    getRefreshToken(),
    getInstallationId(),
  ]);
  const legacyAccessToken = getAuthToken();
  const tokenResponse = await handler<TokenResponse>("/api/v1/auth/refresh", {
    method: "POST",
    auth: false,
    json: refreshToken ? { refresh_token: refreshToken } : undefined,
    headers: {
      "X-Client-Platform": "mobile",
      "X-Installation-ID": installationId,
      ...(!refreshToken && legacyAccessToken
        ? { Authorization: `Bearer ${legacyAccessToken}` }
        : {}),
    },
  });
  const user = await handler<AuthUser>("/api/v1/auth/me", {
    auth: false,
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
  });
  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? undefined,
    expiresIn: tokenResponse.expires_in,
    user,
  };
}

export async function logoutCurrentSession(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return;
  await handler<void>("/api/v1/auth/logout", {
    method: "POST",
    auth: false,
    json: { refresh_token: refreshToken },
  });
}

export function registerUser(payload: RegisterPayload): Promise<AuthSession> {
  return exchangeToken("/api/v1/auth/register", payload);
}

export function loginUser(payload: LoginPayload): Promise<AuthSession> {
  return exchangeToken("/api/v1/auth/login", payload);
}

export function loginWithGoogle(payload: SSOAssertionPayload): Promise<AuthSession> {
  return exchangeToken("/api/v1/auth/google", payload);
}

export function loginWithMicrosoft(
  payload: SSOAssertionPayload,
): Promise<AuthSession> {
  return exchangeToken("/api/v1/auth/microsoft", payload);
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
