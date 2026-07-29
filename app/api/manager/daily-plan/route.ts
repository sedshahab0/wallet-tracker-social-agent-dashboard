import { hasDashboardSession } from "@/lib/auth";
import { readDailyPlan } from "@/lib/daily-plan-store";
import { runDailyManager, tehranDate } from "@/lib/daily-manager-runner";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function GET() {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const plan = await readDailyPlan(tehranDate());
  return plan ? json({ ok: true, plan, cached: true }) : json({ ok: false, missing: true, error: "برنامه امروز هنوز ساخته نشده است." }, 404);
}

export async function POST(request: Request) {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  try {
    const result = await runDailyManager(request, Boolean(body.force));
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "ساخت برنامه امروز ناموفق بود." }, 502);
  }
}
