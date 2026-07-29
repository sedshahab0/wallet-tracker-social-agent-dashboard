import { hasDashboardSession } from "@/lib/auth";
import { getUsageSummary } from "@/lib/usage-tracker";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function GET() {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  try {
    const usage = await getUsageSummary();
    return json({ ok: true, usage });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "دریافت مصرف AI ناموفق بود." }, 502);
  }
}
