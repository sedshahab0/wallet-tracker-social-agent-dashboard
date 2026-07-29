import { hasDashboardSession } from "@/lib/auth";
import { verifyPublication } from "@/lib/publish-verify";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function POST(request: Request) {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    text?: unknown;
    targetUrl?: unknown;
  } | null;
  const kind = body?.kind === "reply" ? "reply" : body?.kind === "interaction" ? "interaction" : body?.kind === "post" ? "post" : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const targetUrl = typeof body?.targetUrl === "string" ? body.targetUrl.trim() : "";
  if (!kind || text.length < 12) return json({ ok: false, error: "درخواست تأیید انتشار معتبر نیست." }, 400);
  try {
    const result = await verifyPublication({ kind, text, targetUrl: targetUrl || undefined });
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "راستی‌آزمایی انتشار ناموفق بود." }, 502);
  }
}
