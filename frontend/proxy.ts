import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  ACTIVE_EVENT_COOKIE,
  AUTH_TOKEN_COOKIE,
  EVENT_LOCALE_COOKIE,
} from "@/lib/constants/cookies";

// 1. Define guarded routes cleanly
const AUTH_REQUIRED_PREFIXES = ["/setup", "/dashboard"]; // Added /dashboard to strictly require Auth
const EVENT_REQUIRED_PREFIXES = ["/dashboard/editor", "/dashboard/guests"];
const LOGIN_PATH = "/login";
const DASHBOARD_PATH = "/dashboard";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 2. Extract cookies
  const authToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const activeEventId = request.cookies.get(ACTIVE_EVENT_COOKIE)?.value;
  const eventLocale = request.cookies.get(EVENT_LOCALE_COOKIE)?.value ?? "en";

  const requiresAuth = AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const requiresEvent = EVENT_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // 3. Enforce Authentication (Must be logged in to see protected pages)
  if (requiresAuth && !authToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Enforce Event/Workspace Selection
  if (requiresEvent && !activeEventId) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = DASHBOARD_PATH;
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // 5. Pass request forward and inject useful headers
  const response = NextResponse.next();
  response.headers.set("x-event-locale", eventLocale);

  if (activeEventId) {
    response.headers.set("x-active-event-id", activeEventId);
  }

  if (authToken) {
    response.headers.set("x-auth-token-present", "true");
  }

  return response;
}

export const config = {
  // Added 'api' to exclusions so backend requests don't get trapped by the redirect logic
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
