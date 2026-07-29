import { hasDashboardSession } from "@/lib/auth";
import { readXInbox } from "@/lib/x-inbox";

export async function GET() {
  if (!(await hasDashboardSession())) return Response.json({ ok: false, error: "نشست داشبورد منقضی شده است." }, { status: 401 });
  const state = await readXInbox();
  return Response.json({ ok: true, replies: state.replies, updatedAt: state.updatedAt, resourceReads: state.resourceReads, budgetUsed: state.resourceReads * 0.001 }, { headers: { "cache-control": "no-store, max-age=0" } });
}
