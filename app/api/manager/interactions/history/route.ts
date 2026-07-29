import { hasDashboardSession } from "@/lib/auth";
import {
  appendInteractionRecord,
  commentFingerprint,
  readInteractionHistory,
} from "@/lib/interaction-history";
import { tehranDate } from "@/lib/daily-manager-runner";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function GET() {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const history = await readInteractionHistory();
  return json({ ok: true, history: history.slice(-50).reverse() });
}

export async function POST(request: Request) {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const body = (await request.json().catch(() => null)) as {
    interactionId?: unknown;
    account?: unknown;
    postUrl?: unknown;
    comment?: unknown;
    verified?: unknown;
    matchedUrl?: unknown;
    reachScore?: unknown;
  } | null;

  const interactionId = typeof body?.interactionId === "string" ? body.interactionId.trim() : "";
  const account = typeof body?.account === "string" ? body.account.trim() : "";
  const postUrl = typeof body?.postUrl === "string" ? body.postUrl.trim() : "";
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const verified = Boolean(body?.verified);
  const matchedUrl = typeof body?.matchedUrl === "string" ? body.matchedUrl.trim() : "";
  const reachScore = typeof body?.reachScore === "number" ? body.reachScore : undefined;

  if (!interactionId || !account || !/^https:\/\/(?:www\.)?x\.com\/[^/]+\/status\/\d+/i.test(postUrl) || comment.length < 8) {
    return json({ ok: false, error: "درخواست ثبت تعامل معتبر نیست." }, 400);
  }

  const date = tehranDate();
  const record = {
    id: `${date}-${interactionId}`,
    interactionId,
    account: account.startsWith("@") ? account : `@${account.replace(/^@/, "")}`,
    postUrl,
    comment,
    commentFingerprint: commentFingerprint(comment),
    reachScore,
    verified,
    matchedUrl: matchedUrl || undefined,
    date,
    completedAt: new Date().toISOString(),
  };

  await appendInteractionRecord(record);
  return json({ ok: true, record });
}
