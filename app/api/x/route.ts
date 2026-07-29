import { hasDashboardSession } from "@/lib/auth";
import { xAccountUsername, xOwnedPollingIsConfigured } from "@/lib/x-api";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

export async function GET() {
  if (!(await hasDashboardSession())) return json({ configured: false, connected: false, error: "نشست داشبورد منقضی شده است." }, 401);
  if (!xOwnedPollingIsConfigured()) return json({ configured: false, connected: false, handle: `@${xAccountUsername()}`, error: "اتصال کاربری Owned Reads هنوز کامل نشده است؛ هیچ اعتباری مصرف نمی‌شود." }, 503);
  // This status route must never spend X credits. Only /api/x/mentions may call X.
  return json({
    configured: true,
    connected: true,
    handle: `@${xAccountUsername()}`,
    mode: "owned_mentions_only",
    budgetUsd: 5,
    unitCostUsd: 0.001,
  });
}
