import { hasDashboardSession } from "@/lib/auth";
import { readResearchBridge } from "@/lib/research-bridge";
import { readWhaleWatcherState } from "@/lib/whale-watcher";
import { readXInbox } from "@/lib/x-inbox";
import { isSemiAutoReady } from "@/lib/reply-policy";
import { PROJECT_CONTEXT_REVISION } from "@/lib/project-knowledge";

const headers = { "cache-control": "no-store, max-age=0", "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function GET() {
  if (!(await hasDashboardSession())) return json({ ok: false, error: "نشست داشبورد منقضی شده است." }, 401);
  const [whale, researchBridge, inbox] = await Promise.all([
    readWhaleWatcherState(),
    readResearchBridge(),
    readXInbox(),
  ]);
  const semiAutoReplies = inbox.replies.filter((reply) => reply.contextRevision === PROJECT_CONTEXT_REVISION && reply.semiAutoReady);
  return json({
    ok: true,
    whale,
    researchBridge,
    semiAutoReplyCount: semiAutoReplies.length,
    semiAutoReplies: semiAutoReplies.slice(0, 5).map((reply) => ({
      id: reply.id,
      handle: reply.handle,
      answer: reply.answer,
      confidence: reply.confidence,
    })),
  });
}
