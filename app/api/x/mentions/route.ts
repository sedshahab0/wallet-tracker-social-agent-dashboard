import { hasDashboardSession } from "@/lib/auth";
import { readXInbox } from "@/lib/x-inbox";
import { xAccountId, xAccountUsername } from "@/lib/x-api";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }

/**
 * Read-only dashboard view of data already fetched by the two-minute poller.
 * This route intentionally never calls X, so manually refreshing the browser
 * cannot duplicate paid Owned Reads.
 */
export async function GET() {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const state = await readXInbox();
  return json({
    ok: true,
    account: { id: xAccountId(), username: xAccountUsername() },
    mentions: state.pending,
    replies: state.replies,
    sinceId: state.sinceId,
    updatedAt: state.updatedAt,
  });
}
