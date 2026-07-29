import { hasDashboardSession } from "@/lib/auth";
import { PROJECT_CONTEXT_REVISION } from "@/lib/project-knowledge";
import { readXInbox } from "@/lib/x-inbox";

export async function GET() {
  if (!(await hasDashboardSession())) return Response.json({ ok: false, error: "نشست داشبورد منقضی شده است." }, { status: 401 });
  const state = await readXInbox();
  const replies = state.replies.map((reply) => reply.contextRevision === PROJECT_CONTEXT_REVISION ? reply : {
    ...reply,
    risk: "yellow" as const,
    confidence: Math.min(reply.confidence, 70),
    reviewReason: "این پاسخ با نسخه قدیمی دانش پروژه ساخته شده و تا بازتولید خودکار نباید بدون بررسی مدیر ارسال شود.",
  });
  return Response.json({ ok: true, replies, updatedAt: state.updatedAt, resourceReads: state.resourceReads, budgetUsed: state.resourceReads * 0.001 }, { headers: { "cache-control": "no-store, max-age=0" } });
}
