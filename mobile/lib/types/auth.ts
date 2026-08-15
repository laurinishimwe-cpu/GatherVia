export type AuthProvider = "manual" | "google" | "microsoft";
export type UserTier = "free" | "basic" | "pro";
export type SupportedLanguage = "en" | "fr" | "es" | "de";

export interface HistoricEventRecord {
  id: string;
  slug: string;
  title: string;
  event_type: "marriage" | "corporate" | "private" | "conference" | "gala" | "other";
  event_date: string | null;
  created_at: string;
  ui_language: SupportedLanguage;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  auth_provider: AuthProvider;
  auth_providers: AuthProvider[];
  has_password: boolean;
  tier: UserTier;
  preferred_language: SupportedLanguage | null;
  needs_language_selection: boolean;
  historic_events: HistoricEventRecord[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface SSOAssertionPayload {
  provider_token: string;
  email?: string; 
  full_name?: string;
}
