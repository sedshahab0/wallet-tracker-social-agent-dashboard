import {
  extractHandleFromPostUrl,
  lookupRegistryEntry,
  tierBaseScore,
  tierFromFollowerCount,
  tierLabelFa,
  type InfluenceTier,
} from "./influence-registry.ts";
import type { DailyManagerInteraction } from "./social-manager-types.ts";

export type EngagementSignals = {
  likes?: number;
  reposts?: number;
  replies?: number;
  views?: number;
  followers?: number;
};

export type InteractionScoreFields = {
  reachScore: number;
  tier: InfluenceTier;
  topicRelevance: number;
  accountTierScore: number;
  engagementScore: number;
  freshnessScore: number;
  engagementLabel: string;
  followersLabel: string;
  scoreReasonFa: string;
  threadScraped: boolean;
};

const TOPIC_TERMS = [
  "wallet", "wallets", "on-chain", "onchain", "blockchain", "crypto", "ethereum", "eth", "btc", "bitcoin",
  "defi", "web3", "transaction", "alert", "monitor", "monitoring", "security", "drainer", "phishing",
  "seed phrase", "private key", "whale", "portfolio", "tracker", "analytics", "explorer", "metamask",
  "ledger", "trezor", "solana", "bsc", "token", "address", "holdings", "scam", "hack", "exploit",
];

export const MIN_DISPLAY_SCORE = 55;
export const PREFERRED_SCORE = 70;

function parseCompactCount(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return Number.parseInt(cleaned, 10) || 0;
  const base = Number.parseFloat(match[1]);
  const suffix = (match[2] || "").toUpperCase();
  if (suffix === "K") return Math.round(base * 1_000);
  if (suffix === "M") return Math.round(base * 1_000_000);
  if (suffix === "B") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

export function extractEngagementSignals(text: string): EngagementSignals {
  const blob = text.replace(/\\/g, " ");
  const signals: EngagementSignals = {};

  const patterns: Array<[keyof EngagementSignals, RegExp[]]> = [
    ["likes", [/(\d[\d,.]*[KMB]?)\s*(?:likes?|like\b)/gi, /likes?\s*[:\-]?\s*(\d[\d,.]*[KMB]?)/gi]],
    ["reposts", [/(\d[\d,.]*[KMB]?)\s*(?:reposts?|retweets?)/gi, /reposts?\s*[:\-]?\s*(\d[\d,.]*[KMB]?)/gi]],
    ["replies", [/(\d[\d,.]*[KMB]?)\s*(?:replies|comments?)/gi, /replies?\s*[:\-]?\s*(\d[\d,.]*[KMB]?)/gi]],
    ["views", [/(\d[\d,.]*[KMB]?)\s*(?:views?|impressions?)/gi, /views?\s*[:\-]?\s*(\d[\d,.]*[KMB]?)/gi]],
    ["followers", [/(\d[\d,.]*[KMB]?)\s*followers?/gi, /followers?\s*[:\-]?\s*(\d[\d,.]*[KMB]?)/gi]],
  ];

  for (const [key, regexes] of patterns) {
    for (const regex of regexes) {
      const match = regex.exec(blob);
      if (match?.[1]) {
        const parsed = parseCompactCount(match[1]);
        if (parsed > 0) {
          signals[key] = Math.max(signals[key] || 0, parsed);
          break;
        }
      }
    }
  }

  return signals;
}

function formatCount(value?: number) {
  if (!value || value <= 0) return "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return value.toLocaleString("en-US");
}

export function scoreTopicRelevance(text: string) {
  const normalized = text.toLocaleLowerCase();
  const hits = TOPIC_TERMS.filter((term) => normalized.includes(term));
  if (hits.length >= 5) return 40;
  if (hits.length >= 3) return 32;
  if (hits.length >= 2) return 24;
  if (hits.length >= 1) return 16;
  return 4;
}

export function scoreFreshness(text: string) {
  const blob = text.toLocaleLowerCase();
  if (/(just now|\d+\s*(?:s|sec|seconds?)\b|minutes? ago|min ago|\d+h ago|hours? ago)/i.test(blob)) return 10;
  if (/(today|yesterday|\d+\s*hours?|\d+h\b)/i.test(blob)) return 8;
  if (/(this week|\d+\s*days? ago|days ago|qdr:w)/i.test(blob)) return 5;
  if (/(this month|\d+\s*weeks? ago|weeks ago)/i.test(blob)) return 2;
  return 3;
}

export function scoreEngagement(signals: EngagementSignals) {
  const likes = signals.likes || 0;
  const reposts = signals.reposts || 0;
  const replies = signals.replies || 0;
  const views = signals.views || 0;
  let score = 0;
  if (likes >= 10_000) score += 12;
  else if (likes >= 1_000) score += 9;
  else if (likes >= 100) score += 6;
  else if (likes >= 20) score += 3;

  if (reposts >= 500) score += 4;
  else if (reposts >= 50) score += 2;

  if (replies >= 200) score += 3;
  else if (replies >= 30) score += 1;

  if (views >= 100_000) score += 4;
  else if (views >= 10_000) score += 2;

  return Math.min(20, score);
}

export function resolveAccountTier(handle: string, signals: EngagementSignals): InfluenceTier {
  const registry = lookupRegistryEntry(handle);
  if (registry) return registry.tier;
  if (signals.followers && signals.followers >= 10_000) return tierFromFollowerCount(signals.followers);
  return "C";
}

export function scoreInteraction(input: {
  interaction: DailyManagerInteraction;
  sourceText?: string;
  threadText?: string;
}): InteractionScoreFields {
  const handle = extractHandleFromPostUrl(input.interaction.postUrl) || input.interaction.account.replace(/^@/, "");
  const combined = `${input.sourceText || ""}\n${input.threadText || ""}\n${input.interaction.reason}\n${input.interaction.comment}`;
  const signals = extractEngagementSignals(combined);
  const tier = resolveAccountTier(handle, signals);
  const topicRelevance = scoreTopicRelevance(combined);
  const accountTierScore = tierBaseScore(tier);
  const engagementScore = scoreEngagement(signals);
  const freshnessScore = scoreFreshness(combined);
  const reachScore = Math.min(100, topicRelevance + accountTierScore + engagementScore + freshnessScore);

  const engagementParts = [
    signals.likes ? `${formatCount(signals.likes)} likes` : "",
    signals.views ? `${formatCount(signals.views)} views` : "",
    signals.reposts ? `${formatCount(signals.reposts)} reposts` : "",
  ].filter(Boolean);

  const followersLabel = signals.followers
    ? `${formatCount(signals.followers)} followers`
    : lookupRegistryEntry(handle)
      ? `${tierLabelFa(tier).split("·")[0].trim()}`
      : "";

  const scoreReasonFa = [
    tierLabelFa(tier),
    topicRelevance >= 24 ? "موضوع مرتبط با ولت/کریپتو" : "ارتباط موضوعی متوسط",
    engagementParts.length ? `تعامل: ${engagementParts.join(" · ")}` : "سیگنال تعامل محدود در scrape",
    reachScore >= PREFERRED_SCORE ? "اولویت بالا برای تعامل" : reachScore >= MIN_DISPLAY_SCORE ? "قابل بررسی" : "اولویت پایین",
  ].join(" · ");

  return {
    reachScore,
    tier,
    topicRelevance,
    accountTierScore,
    engagementScore,
    freshnessScore,
    engagementLabel: engagementParts.join(" · "),
    followersLabel,
    scoreReasonFa,
    threadScraped: Boolean(input.threadText?.trim()),
  };
}

export function rankScoredInteractions<T extends InteractionScoreFields>(scored: T[]) {
  const sorted = [...scored].sort((a, b) => b.reachScore - a.reachScore || b.engagementScore - a.engagementScore);
  const preferred = sorted.filter((item) => item.reachScore >= PREFERRED_SCORE);
  const acceptable = sorted.filter((item) => item.reachScore >= MIN_DISPLAY_SCORE);
  return (preferred.length >= 2 ? preferred : acceptable.length ? acceptable : sorted).slice(0, 4);
}
