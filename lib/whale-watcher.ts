import { lookupRegistryEntry } from "./influence-registry.ts";
import { extractEngagementSignals, scoreInteraction, scoreTopicRelevance } from "./interaction-score-core.ts";
import { extractStatusUrls, normalizeXUrl } from "./x-thread.ts";

export type WhaleAlert = {
  id: string;
  account: string;
  postUrl: string;
  tier: "S" | "A";
  reachScore: number;
  engagementLabel: string;
  topic: string;
  reasonFa: string;
  detectedAt: string;
};

export type WhaleWatcherState = {
  alertedUrls: string[];
  lastRunAt: string;
  lastAlertCount: number;
  lastAlerts: WhaleAlert[];
};

const memory: WhaleWatcherState = { alertedUrls: [], lastRunAt: "", lastAlertCount: 0, lastAlerts: [] };

function statePath() {
  return process.env.WHALE_WATCHER_STATE_PATH?.trim() || ".wrangler/social-manager/whale-watcher.json";
}

export async function readWhaleWatcherState(): Promise<WhaleWatcherState> {
  if (memory.lastRunAt) return { ...memory, alertedUrls: [...memory.alertedUrls] };
  try {
    const { readFile } = await import("node:fs/promises");
    const parsed = JSON.parse(await readFile(statePath(), "utf8")) as WhaleWatcherState;
    Object.assign(memory, parsed);
    return { ...parsed, alertedUrls: [...(parsed.alertedUrls || [])] };
  } catch {
    return { alertedUrls: [], lastRunAt: "", lastAlertCount: 0, lastAlerts: [] };
  }
}

async function writeWhaleWatcherState(state: WhaleWatcherState) {
  Object.assign(memory, state);
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(statePath()), { recursive: true });
    await writeFile(statePath(), JSON.stringify({ ...state, alertedUrls: state.alertedUrls.slice(-300) }), "utf8");
  } catch {
    // memory fallback
  }
}

function normalizeUrl(url: string) {
  return normalizeXUrl(url) || url.replace(/\/$/, "");
}

function alertFromHit(hit: { title?: string; description?: string; markdown?: string; url?: string }) {
  const blob = `${hit.title || ""}\n${hit.description || ""}\n${hit.markdown || ""}\n${hit.url || ""}`;
  const postUrl = extractStatusUrls([blob, hit.url || ""].filter(Boolean).join("\n"))[0] || normalizeUrl(hit.url || "");
  if (!postUrl || !/^https:\/\/x\.com\/[^/]+\/status\/\d+/.test(postUrl)) return null;

  const handle = postUrl.match(/x\.com\/([A-Za-z0-9_]+)\/status\//)?.[1] || "";
  const registry = lookupRegistryEntry(handle);
  const tier = registry?.tier;
  if (tier !== "S" && tier !== "A") return null;
  if (scoreTopicRelevance(blob) < 16) return null;

  const score = scoreInteraction({
    interaction: {
      id: postUrl,
      time: "now",
      account: `@${handle}`,
      postUrl,
      reason: hit.title || "High-reach crypto discourse",
      comment: "",
      language: "English",
      risk: "green",
    },
    sourceText: blob,
    threadText: blob,
  });
  if (score.reachScore < 65) return null;

  return {
    id: postUrl.match(/status\/(\d+)/)?.[1] || postUrl,
    account: `@${handle}`,
    postUrl,
    tier,
    reachScore: score.reachScore,
    engagementLabel: score.engagementLabel || extractEngagementSignals(blob).likes ? `${extractEngagementSignals(blob).likes} likes` : "",
    topic: (hit.title || hit.description || "").replace(/\s+/g, " ").trim().slice(0, 120),
    reasonFa: `${score.scoreReasonFa} · رصد خودکار Agent`,
    detectedAt: new Date().toISOString(),
  } satisfies WhaleAlert;
}

export async function runWhaleWatcher(
  firecrawlSearch: (query: string) => Promise<Array<{ title?: string; description?: string; markdown?: string; url?: string }>>,
) {
  const state = await readWhaleWatcherState();
  const alerted = new Set(state.alertedUrls.map(normalizeUrl));
  const tierHandles = ["WhaleAlert", "PeckShieldAlert", "lookonchain", "VitalikButerin", "zachxbt", "MetaMask", "Etherscan", "glassnode"];
  const handleQuery = tierHandles.map((handle) => `@${handle}`).join(" OR ");
  const queries = [
    `site:x.com/*/status ("whale alert" OR "wallet drainer" OR "wallet security" OR "on-chain") (${handleQuery})`,
    `site:x.com/*/status ("crypto wallet" OR "transaction alert" OR "onchain monitoring") (${handleQuery})`,
  ];

  const hits = (await Promise.all(queries.map((query) => firecrawlSearch(query).catch(() => [])))).flat();
  const alerts: WhaleAlert[] = [];
  for (const hit of hits) {
    const alert = alertFromHit(hit);
    if (!alert) continue;
    const key = normalizeUrl(alert.postUrl);
    if (alerted.has(key)) continue;
    alerted.add(key);
    alerts.push(alert);
  }

  alerts.sort((a, b) => b.reachScore - a.reachScore);
  const selected = alerts.slice(0, 3);
  const nextState: WhaleWatcherState = {
    alertedUrls: [...alerted],
    lastRunAt: new Date().toISOString(),
    lastAlertCount: selected.length,
    lastAlerts: selected,
  };
  await writeWhaleWatcherState(nextState);
  return { alerts: selected, state: nextState };
}
