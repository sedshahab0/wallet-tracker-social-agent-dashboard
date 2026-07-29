import { extractEngagementSignals } from "./interaction-score-core.ts";

export type AccountSnapshot = {
  capturedAt: string;
  followers?: number;
  recentPostCount: number;
  avgEngagementScore: number;
  topPostSnippet: string;
};

export type AccountIntelligence = {
  current: AccountSnapshot;
  previous?: AccountSnapshot;
  followerDelta?: number;
  postCountDelta?: number;
  engagementTrend: "up" | "flat" | "down" | "unknown";
  summaryFa: string;
};

const cachedSnapshot: { value: AccountSnapshot | null } = { value: null };

function statePath() {
  return process.env.ACCOUNT_INTELLIGENCE_PATH?.trim() || ".wrangler/social-manager/account-intelligence.json";
}

async function readPreviousSnapshot(): Promise<AccountSnapshot | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(statePath(), "utf8")) as AccountSnapshot;
  } catch {
    return cachedSnapshot.value;
  }
}

async function writeSnapshot(snapshot: AccountSnapshot) {
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(statePath()), { recursive: true });
    await writeFile(statePath(), JSON.stringify(snapshot), "utf8");
  } catch {
    // ignore
  }
}

function engagementScoreFromPosts(posts: Array<{ text: string; postedAt?: string }>, profileMarkdown: string) {
  const blob = `${profileMarkdown}\n${posts.map((post) => post.text).join("\n")}`;
  const signals = extractEngagementSignals(blob);
  let score = 0;
  if ((signals.likes || 0) >= 100) score += 2;
  if ((signals.views || 0) >= 1000) score += 2;
  if (posts.length >= 3) score += 1;
  return score;
}

export async function buildAccountIntelligence(profileMarkdown: string, posts: Array<{ text: string; postedAt?: string; url?: string }>): Promise<AccountIntelligence> {
  const signals = extractEngagementSignals(profileMarkdown);
  const current: AccountSnapshot = {
    capturedAt: new Date().toISOString(),
    followers: signals.followers,
    recentPostCount: posts.length,
    avgEngagementScore: engagementScoreFromPosts(posts, profileMarkdown),
    topPostSnippet: posts[0]?.text?.slice(0, 120) || "",
  };
  const previous = await readPreviousSnapshot();
  await writeSnapshot(current);

  const followerDelta = current.followers !== undefined && previous?.followers !== undefined
    ? current.followers - previous.followers
    : undefined;
  const postCountDelta = previous ? current.recentPostCount - previous.recentPostCount : undefined;
  const engagementTrend = !previous
    ? "unknown"
    : current.avgEngagementScore > previous.avgEngagementScore
      ? "up"
      : current.avgEngagementScore < previous.avgEngagementScore
        ? "down"
        : "flat";

  const summaryFa = [
    current.followers ? `${current.followers.toLocaleString("en-US")} followers` : "followers نامشخص",
    followerDelta !== undefined && followerDelta !== 0 ? `Δ followers ${followerDelta > 0 ? "+" : ""}${followerDelta}` : "",
    `${current.recentPostCount} پست اخیر`,
    postCountDelta !== undefined && postCountDelta !== 0 ? `Δ posts ${postCountDelta > 0 ? "+" : ""}${postCountDelta}` : "",
    engagementTrend === "up" ? "روند تعامل: رو به بالا" : engagementTrend === "down" ? "روند تعامل: افت" : engagementTrend === "flat" ? "روند تعامل: ثابت" : "روند تعامل: نامشخص",
  ].filter(Boolean).join(" · ");

  return { current, previous: previous || undefined, followerDelta, postCountDelta, engagementTrend, summaryFa };
}

export function accountIntelligenceForPrompt(intelligence: AccountIntelligence | null) {
  if (!intelligence) return "Account intelligence unavailable.";
  return [
    "Own-account intelligence snapshot:",
    intelligence.summaryFa,
    intelligence.current.topPostSnippet ? `Latest visible post theme: ${intelligence.current.topPostSnippet}` : "",
    intelligence.engagementTrend === "up"
      ? "Publishing cadence can stay active if evidence supports it."
      : intelligence.engagementTrend === "down"
        ? "Prefer higher-quality posts over volume until engagement stabilizes."
        : "Use conservative cadence when trend is unclear.",
  ].filter(Boolean).join("\n");
}
