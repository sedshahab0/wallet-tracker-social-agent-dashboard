import { cookies, headers } from "next/headers";
import {
  createDashboardSessionToken,
  DASHBOARD_SESSION_COOKIE,
  DASHBOARD_SESSION_MAX_AGE,
  dashboardAuthIsConfigured,
  dashboardCredentialsAreValid,
  safeDashboardPath,
} from "@/lib/auth";

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function requesterKey(forwardedFor: string | null) {
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  if (!dashboardAuthIsConfigured()) {
    return Response.json({ ok: false, error: "ورود روی سرور پیکربندی نشده است." }, { status: 503 });
  }

  const requestHeaders = await headers();
  const key = requesterKey(requestHeaders.get("x-forwarded-for") || requestHeaders.get("x-real-ip"));
  const now = Date.now();
  const previous = attempts.get(key);
  const attempt = !previous || previous.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : previous;
  if (attempt.count >= MAX_ATTEMPTS) {
    return Response.json({ ok: false, error: "تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه دیگر دوباره امتحان کنید." }, { status: 429 });
  }

  let body: { username?: unknown; password?: unknown; next?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "درخواست ورود معتبر نیست." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!dashboardCredentialsAreValid(username, password)) {
    attempts.set(key, { ...attempt, count: attempt.count + 1 });
    return Response.json({ ok: false, error: "نام کاربری یا رمز عبور صحیح نیست." }, { status: 401 });
  }

  attempts.delete(key);
  const token = await createDashboardSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(DASHBOARD_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DASHBOARD_SESSION_MAX_AGE,
  });

  return Response.json({ ok: true, next: safeDashboardPath(typeof body.next === "string" ? body.next : "/") });
}
