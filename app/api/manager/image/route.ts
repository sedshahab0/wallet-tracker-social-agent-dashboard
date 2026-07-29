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
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(45_000) });
    if (!imageResponse.ok) throw new Error(`دریافت فایل تصویر از xAI ناموفق بود (${imageResponse.status}).`);
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (!bytes.length || bytes.length > 4_500_000) throw new Error("حجم تصویر تولیدشده قابل ذخیره‌سازی نیست.");
    const mimeType = payload.data?.[0]?.mime_type || imageResponse.headers.get("content-type") || "image/jpeg";
    const imageDataUrl = `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
    return json({ ok: true, imageUrl: imageDataUrl, temporary: false });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "تولید تصویر ناموفق بود." }, 502);
  }
}
