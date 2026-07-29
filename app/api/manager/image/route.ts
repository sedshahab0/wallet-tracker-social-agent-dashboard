import { hasDashboardSession } from "@/lib/auth";

type ImagePayload = { data?: Array<{ url?: string; mime_type?: string }>; error?: { message?: string } };
const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function POST(request: Request) {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return json({ ok: false, error: "کلید xAI روی سرور تنظیم نشده است." }, 503);
  const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 20 || prompt.length > 1500) return json({ ok: false, error: "پرامپت تصویر معتبر نیست." }, 400);
  try {
    const response = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.XAI_IMAGE_MODEL?.trim() || "grok-imagine-image", prompt, response_format: "url", aspect_ratio: "16:9", resolution: "1k", n: 1 }),
      signal: AbortSignal.timeout(120_000),
    });
    const payload = (await response.json().catch(() => ({}))) as ImagePayload;
    const imageUrl = payload.data?.[0]?.url;
    if (!response.ok || !imageUrl) throw new Error(payload.error?.message || `xAI image error (${response.status})`);
    return json({ ok: true, imageUrl, temporary: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "تولید تصویر ناموفق بود." }, 502);
  }
}
