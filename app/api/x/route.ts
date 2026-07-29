import { hasDashboardSession } from "@/lib/auth";
import { resolveXAccount, XApiError, xAccountUsername, xApiIsConfigured } from "@/lib/x-api";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

export async function GET() {
  if (!(await hasDashboardSession())) return json({ configured: false, connected: false, error: "نشست داشبورد منقضی شده است." }, 401);
  if (!xApiIsConfigured()) return json({ configured: false, connected: false, handle: `@${xAccountUsername()}`, error: "کلیدهای X API روی سرور تنظیم نشده‌اند." }, 503);

  try {
    const account = await resolveXAccount();
    return json({
      configured: true,
      connected: account.username.toLocaleLowerCase() === xAccountUsername().toLocaleLowerCase(),
      handle: `@${account.username}`,
      account,
    });
  } catch (error) {
    if (error instanceof XApiError) {
      return json({ configured: true, connected: false, handle: `@${xAccountUsername()}`, code: error.code, needsCredit: error.code === "credits_required", error: error.message }, error.status);
    }
    return json({ configured: true, connected: false, handle: `@${xAccountUsername()}`, error: "بررسی اتصال X ناموفق بود." }, 502);
  }
}

