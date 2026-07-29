import { hasDashboardSession } from "@/lib/auth";
import { XApiError, xAccountId, xAccountUsername, xGetOwned } from "@/lib/x-api";

type Mention = { id: string; text: string; author_id?: string; created_at?: string; lang?: string; conversation_id?: string };
type MentionEnvelope = {
  data?: Mention[];
  includes?: { users?: Array<{ id: string; name: string; username: string; profile_image_url?: string }> };
  meta?: { newest_id?: string; oldest_id?: string; result_count?: number; next_token?: string };
};

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }

export async function GET(request: Request) {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const sinceId = new URL(request.url).searchParams.get("since_id")?.trim() || "";
  if (sinceId && !/^\d{1,19}$/.test(sinceId)) return json({ ok: false, error: "شناسه شروع پایش معتبر نیست." }, 400);

  try {
    const account = { id: xAccountId(), username: xAccountUsername() };
    if (!account.id) return json({ ok: false, error: "شناسه عددی اکانت X هنوز تنظیم نشده است؛ برای جلوگیری از هزینه غیر Owned، هیچ درخواست جانبی اجرا نشد." }, 503);
    const params = new URLSearchParams({
      max_results: "10",
      "tweet.fields": "author_id,created_at,lang,conversation_id",
      expansions: "author_id",
      "user.fields": "id,name,username,profile_image_url",
    });
    if (sinceId) params.set("since_id", sinceId);
    const payload = await xGetOwned<Mention[]>(`/2/users/${account.id}/mentions?${params.toString()}`) as MentionEnvelope;
    return json({ ok: true, account: { id: account.id, username: account.username }, mentions: payload.data || [], users: payload.includes?.users || [], meta: payload.meta || {} });
  } catch (error) {
    if (error instanceof XApiError) return json({ ok: false, code: error.code, needsCredit: error.code === "credits_required", error: error.message }, error.status);
    return json({ ok: false, error: "دریافت منشن‌های X ناموفق بود." }, 502);
  }
}
