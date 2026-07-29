import { readDailyPlan, writeDailyPlan } from "@/lib/daily-plan-store";
import { enrichPlanInteractions } from "@/lib/interaction-scorer";
import { buildDailyPlan, collectLiveSources, notifyDailyPlan } from "@/lib/social-manager";
import { PROJECT_CONTEXT_REVISION } from "@/lib/project-knowledge";

export function tehranDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function runDailyManager(request: Request, force = false, focus = "") {
  const date = tehranDate();
  if (!force) {
    const cached = await readDailyPlan(date);
    if (cached?.contextRevision === PROJECT_CONTEXT_REVISION && cached.accountState) {
      return { plan: cached, cached: true, telegramNotified: false };
    }
  }
  const { sources, accountState } = await collectLiveSources(date, focus);
  const draftPlan = await buildDailyPlan(date, sources, accountState, focus);
  const plan = await enrichPlanInteractions(draftPlan);
  await writeDailyPlan(plan);
  const telegramNotified = await notifyDailyPlan(request, plan).catch(() => false);
  return { plan, cached: false, telegramNotified };
}
