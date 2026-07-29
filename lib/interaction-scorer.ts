import { regenerateInteractionComment } from "@/lib/interaction-comment";
import {
  isSimilarRecentComment,
  type InteractionHistoryRecord,
  wasAccountRecentlyEngaged,
  wasPostRecentlyEngaged,
} from "@/lib/interaction-history";
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
    const payload = await firecrawlScrapeRaw(postUrl, { waitFor: 2000, maxAge: 120_000, timeout: 28_000 });
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

function shouldSkipInteraction(interaction: DailyManagerInteraction, history: InteractionHistoryRecord[]) {
  if (wasPostRecentlyEngaged(interaction.postUrl, history)) return true;
  if (wasAccountRecentlyEngaged(interaction.account, history, 3)) return true;
  if (isSimilarRecentComment(interaction.comment, history)) return true;
  return false;
}

export async function enrichPlanInteractions(
  plan: DailyManagerPlan,
  history: InteractionHistoryRecord[] = [],
): Promise<DailyManagerPlan> {
  const candidates = plan.interactions.filter((interaction) => !shouldSkipInteraction(interaction, history));
  if (!candidates.length) return { ...plan, interactions: [] };

  const scored = await Promise.all(candidates.map(async (interaction) => {
    const sourceText = sourceTextForInteraction(plan, interaction);
    const threadText = await scrapeThreadContext(interaction.postUrl);
    const regen = await regenerateInteractionComment({
      account: interaction.account,
      postUrl: interaction.postUrl,
      threadMarkdown: threadText || sourceText,
      draftComment: interaction.comment,
      reason: interaction.reason,
      language: interaction.language,
    }).catch(() => ({
      comment: interaction.comment,
      reason: interaction.reason,
      language: interaction.language,
      risk: interaction.risk,
      regenerated: false,
    }));

    if (regen.risk === "red") return null;

    const merged: DailyManagerInteraction = {
      ...interaction,
      comment: regen.comment,
      reason: regen.reason,
      language: regen.language,
      risk: regen.risk,
      threadEnriched: threadText.trim().length >= 80,
      commentRegenerated: regen.regenerated,
    };

    const score = scoreInteraction({
      interaction: merged,
      sourceText,
      threadText: threadText || sourceText,
    });

    return { ...merged, ...score } satisfies ScoredInteraction;
  }));

  const filtered = scored.filter((item): item is ScoredInteraction => Boolean(item));
  return { ...plan, interactions: rankScoredInteractions(filtered) };
}
