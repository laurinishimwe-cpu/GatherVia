import { cookies } from "next/headers";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");
const REFRESH_COOKIE = "gathervia_refresh";
const REFRESH_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const ACTION_PATHS = {
  login: "/api/v1/auth/login",
  register: "/api/v1/auth/register",
  google: "/api/v1/auth/google",
  microsoft: "/api/v1/auth/microsoft",
  refresh: "/api/v1/auth/refresh",
  logout: "/api/v1/auth/logout",
} as const;

type SessionAction = keyof typeof ACTION_PATHS;

interface SessionRequest {
  action?: SessionAction;
  payload?: unknown;
  legacy_access_token?: string;
}

function isSessionAction(value: unknown): value is SessionAction {
  return typeof value === "string" && value in ACTION_PATHS;
}

function clearRefreshCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  cookieStore.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/session",
    maxAge: 0,
  });
}

export async function POST(request: Request): Promise<Response> {
  let input: SessionRequest;
  try {
    input = (await request.json()) as SessionRequest;
  } catch {
    return Response.json({ detail: "Invalid session request." }, { status: 400 });
  }

  if (!isSessionAction(input.action)) {
    return Response.json({ detail: "Unsupported session action." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const storedRefreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Client-Platform": "web",
  });

  let body: unknown = input.payload;
  if (input.action === "refresh" || input.action === "logout") {
    body = storedRefreshToken ? { refresh_token: storedRefreshToken } : undefined;
    if (!storedRefreshToken && input.legacy_access_token) {
      headers.set("Authorization", `Bearer ${input.legacy_access_token}`);
    }
  }
  if (input.action === "logout") clearRefreshCookie(cookieStore);

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}${ACTION_PATHS[input.action]}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    if (input.action === "logout") return new Response(null, { status: 204 });
    return Response.json(
      { detail: "GatherVia is temporarily unreachable. Please try again." },
      { status: 503 },
    );
  }

  if (input.action === "logout") {
    return new Response(null, { status: upstream.ok ? 204 : upstream.status });
  }

  if (input.action === "refresh" && upstream.status === 401) {
    clearRefreshCookie(cookieStore);
  }

  const responseText = await upstream.text();
  let responseBody: Record<string, unknown> = {};
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      return Response.json({ detail: "Invalid authentication response." }, { status: 502 });
    }
  }

  if (upstream.ok && typeof responseBody.refresh_token === "string") {
    cookieStore.set(REFRESH_COOKIE, responseBody.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/session",
      maxAge: REFRESH_MAX_AGE_SECONDS,
      priority: "high",
    });
    delete responseBody.refresh_token;
  }

  return Response.json(responseBody, { status: upstream.status });
}
