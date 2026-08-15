import type { Href } from "expo-router";
import type { AuthUser } from "@/lib/types/auth";

export function getPostAuthRoute(user: AuthUser): Href {
  return user.needs_language_selection
    ? "/(tabs)/language"
    : "/(tabs)/dashboard";
}
