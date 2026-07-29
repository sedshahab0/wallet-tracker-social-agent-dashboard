import { firecrawlScrapeRaw } from "@/lib/firecrawl";
import {
  rankScoredInteractions,
  scoreInteraction,
  type InteractionScoreFields,
} from "@/lib/interaction-score-core";
import type { DailyManagerInteraction, DailyManagerPlan } from "@/lib/social-manager-types";

export type { EngagementSignals, InteractionScoreFields } from "@/lib/interaction-score-core";
export {
  extractEngagementSignals,
  MIN_DISPLAY_SCORE,
  PREFERRED_SCORE,
  rankScoredInteractions,
  scoreEngagement,
  scoreFreshness,
  scoreInteraction,
  scoreTopicRelevance,
} from "@/lib/interaction-score-core";

export type ScoredInteraction = DailyManagerInteraction & InteractionScoreFields;

async function scrapeThreadContext(postUrl: string) {
  try {
    const payload = await firecrawlScrapeRaw(postUrl, { waitFor: 1500, maxAge: 120_000, timeout: 25_000 });
    return payload.data?.markdown || "";
  } catch {
    return "";
  }
}

function sourceTextForInteraction(plan: DailyManagerPlan, interaction: DailyManagerInteraction) {
  const normalized = interaction.postUrl.replace(/\/$/, "");
  const source = plan.sources.find((item) => item.url.replace(/\/$/, "") === normalized);
  return source?.description || "";
}

export async function enrichPlanInteractions(plan: DailyManagerPlan): Promise<DailyManagerPlan> {
  if (!plan.interactions.length) return plan;

  const scored = await Promise.all(plan.interactions.map(async (interaction) => {
    const sourceText = sourceTextForInteraction(plan, interaction);
    const threadText = await scrapeThreadContext(interaction.postUrl);
    const score = scoreInteraction({ interaction, sourceText, threadText });
    return { ...interaction, ...score } satisfies ScoredInteraction;
  }));

  return { ...plan, interactions: rankScoredInteractions(scored) };
}
