import { timingSafeEqual } from "node:crypto";
import { hasDashboardSession } from "@/lib/auth";
import { runWhaleWatcherJob } from "@/lib/whale-watcher-runner";
import { readWhaleWatcherState } from "@/lib/whale-watcher";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function authorized(request: Request) {
  const expected = process.env.SOCIAL_MANAGER_CRON_SECRET?.trim() || "";
  const received = request.headers.get("x-manager-cron-key")?.trim() || "";
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function GET() {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const state = await readWhaleWatcherState();
  return json({ ok: true, state });
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ ok: false, error: "دسترسی زمان‌بندی معتبر نیست." }, 401);
  try {
    const result = await runWhaleWatcherJob(request);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "رصد نهنگ ناموفق بود." }, 502);
  }
}
