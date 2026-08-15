import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { AuthSession, AuthUser } from "@/lib/types/auth";

export const AUTH_SESSION_STORAGE_KEY = "gatekeep.auth.session";
const AUTH_PROFILE_STORAGE_KEY = "gathervia.auth.profile.v2";
const REFRESH_TOKEN_STORAGE_KEY = "gathervia.auth.refresh-token.v1";
const INSTALLATION_ID_STORAGE_KEY = "gathervia.auth.installation-id.v1";

let cachedAccessToken: string | null = null;
const invalidationListeners = new Set<() => void>();

async function ensureInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_STORAGE_KEY);
  if (existing) return existing;

  // Android removes both stores on uninstall. iOS Keychain may survive, so a
  // missing app-container marker deliberately invalidates any leftover secret.
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(() => undefined);
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALLATION_ID_STORAGE_KEY, created);
  return created;
}

export function getAuthToken(): string | null {
  return cachedAccessToken;
}

export async function getInstallationId(): Promise<string> {
  return ensureInstallationId();
}

export async function getRefreshToken(): Promise<string | null> {
  await ensureInstallationId();
  return SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
}

export async function updateAuthTokens(
  accessToken: string,
  refreshToken?: string | null,
): Promise<void> {
  cachedAccessToken = accessToken;
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, refreshToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  }
}

export async function persistAuthSession(session: AuthSession): Promise<void> {
  await updateAuthTokens(session.accessToken, session.refreshToken);
  await AsyncStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(session.user));
  if (session.refreshToken) {
    // Remove the legacy record once the backend has issued a secure refresh session.
    await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } else {
    // Backward-compatible rollout fallback until the new backend is deployed.
    await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }
}

export async function clearAuthSession(): Promise<void> {
  cachedAccessToken = null;
  await Promise.all([
    SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY),
    AsyncStorage.removeItem(AUTH_PROFILE_STORAGE_KEY),
    AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY),
  ]);
}

export function subscribeToAuthInvalidation(listener: () => void): () => void {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

export async function invalidateAuthSession(): Promise<void> {
  await clearAuthSession();
  invalidationListeners.forEach((listener) => listener());
}

export async function hydrateAuthSession(): Promise<AuthSession | null> {
  await ensureInstallationId();
  const [profileRaw, refreshToken, legacyRaw] = await Promise.all([
    AsyncStorage.getItem(AUTH_PROFILE_STORAGE_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY),
    AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY),
  ]);

  if (profileRaw) {
    try {
      const user = JSON.parse(profileRaw) as AuthUser;
      return { accessToken: "", refreshToken: refreshToken ?? undefined, user };
    } catch {
      await AsyncStorage.removeItem(AUTH_PROFILE_STORAGE_KEY);
    }
  }

  // One-time migration for APKs that stored the access token in AsyncStorage.
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw) as AuthSession;
      cachedAccessToken = legacy.accessToken;
      return legacy;
    } catch {
      await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    }
  }

  return null;
}
