import { accountIntelligenceForPrompt } from "@/lib/account-intelligence";
import { readDailyPlan, writeDailyPlan } from "@/lib/daily-plan-store";
import { historySummaryForPrompt, readInteractionHistory } from "@/lib/interaction-history";
import { enrichPlanInteractions } from "@/lib/interaction-scorer";
import { readResearchBridge, researchBridgeForPrompt } from "@/lib/research-bridge";
import { buildDailyPlan, collectLiveSources, notifyDailyPlan } from "@/lib/social-manager";
import { PROJECT_CONTEXT_REVISION } from "@/lib/project-knowledge";
import type { AccountState } from "@/lib/social-manager-types";

function accountIntelligenceContext(accountState: AccountState) {
  if (!accountState.intelligenceSummaryFa) return "Account intelligence unavailable.";
  return accountIntelligenceForPrompt({
    current: {
      capturedAt: accountState.scrapedAt,
      recentPostCount: accountState.recentPosts.length,
      avgEngagementScore: 0,
      topPostSnippet: accountState.recentPosts[0]?.text?.slice(0, 120) || "",
    },
    engagementTrend: accountState.engagementTrend || "unknown",
    summaryFa: accountState.intelligenceSummaryFa,
  });
}

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
  const history = await readInteractionHistory();
  const [researchBridge, { sources, accountState }] = await Promise.all([
    readResearchBridge(),
    collectLiveSources(date, focus),
  ]);
  const draftPlan = await buildDailyPlan(
    date,
    sources,
    accountState,
    focus,
    historySummaryForPrompt(history),
    researchBridgeForPrompt(researchBridge),
    accountIntelligenceContext(accountState),
  );
  const plan = await enrichPlanInteractions(draftPlan, history);
  await writeDailyPlan(plan);
  const telegramNotified = await notifyDailyPlan(request, plan).catch(() => false);
  return { plan, cached: false, telegramNotified };
}
