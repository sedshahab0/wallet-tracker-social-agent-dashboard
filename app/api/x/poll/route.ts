import { timingSafeEqual } from "node:crypto";
import { pollOwnedMentions } from "@/lib/x-inbox";
import { XApiError } from "@/lib/x-api";

function authorized(request: Request) {
  const expected = process.env.SOCIAL_MANAGER_CRON_SECRET?.trim() || "";
  const received = request.headers.get("x-manager-cron-key")?.trim() || "";
  return Boolean(expected && expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received)));
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "دسترسی پایش معتبر نیست." }, { status: 401 });
  try {
    const result = await pollOwnedMentions(request);
    return Response.json({ ok: true, newReplies: result.newReplies, stopped: result.stopped, telegramNotified: result.telegramNotified, resourceReads: result.state.resourceReads });
  } catch (error) {
    if (error instanceof XApiError) return Response.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "پایش منشن‌ها ناموفق بود." }, { status: 502 });
  }
}
