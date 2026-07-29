import { normalizeComparableText } from "./x-thread.ts";

export type InteractionHistoryRecord = {
  id: string;
  interactionId: string;
  account: string;
  postUrl: string;
  comment: string;
  commentFingerprint: string;
  reachScore?: number;
  verified: boolean;
  matchedUrl?: string;
  date: string;
  completedAt: string;
};

const memory: InteractionHistoryRecord[] = [];

function statePath() {
  return process.env.INTERACTION_HISTORY_PATH?.trim() || ".wrangler/social-manager/interaction-history.json";
}

export function commentFingerprint(comment: string) {
  return normalizeComparableText(comment).slice(0, 96);
}

export function normalizePostUrl(postUrl: string) {
  return postUrl.trim().replace(/\/$/, "");
}

export async function readInteractionHistory(): Promise<InteractionHistoryRecord[]> {
  if (memory.length) return [...memory];
  try {
    const { readFile } = await import("node:fs/promises");
    const parsed = JSON.parse(await readFile(statePath(), "utf8")) as InteractionHistoryRecord[];
    memory.splice(0, memory.length, ...parsed);
    return [...memory];
  } catch {
    return [];
  }
}

async function writeInteractionHistory(records: InteractionHistoryRecord[]) {
  memory.splice(0, memory.length, ...records);
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(statePath()), { recursive: true });
    await writeFile(statePath(), JSON.stringify(records.slice(-200)), "utf8");
  } catch {
    // In-memory fallback for read-only runtimes.
  }
}

export async function appendInteractionRecord(record: InteractionHistoryRecord) {
  const history = await readInteractionHistory();
  const withoutDuplicate = history.filter((item) => item.interactionId !== record.interactionId || item.date !== record.date);
  await writeInteractionHistory([...withoutDuplicate, record].slice(-200));
}

export function historyWithinDays(history: InteractionHistoryRecord[], days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  return history.filter((item) => {
    const stamp = Date.parse(item.completedAt);
    return Number.isFinite(stamp) && stamp >= cutoff;
  });
}

export function wasPostRecentlyEngaged(postUrl: string, history: InteractionHistoryRecord[], days = 7) {
  const normalized = normalizePostUrl(postUrl);
  return historyWithinDays(history, days).some((item) => normalizePostUrl(item.postUrl) === normalized);
}

export function wasAccountRecentlyEngaged(account: string, history: InteractionHistoryRecord[], days = 3) {
  const handle = account.trim().replace(/^@/, "").toLowerCase();
  return historyWithinDays(history, days).some((item) => item.account.trim().replace(/^@/, "").toLowerCase() === handle);
}

export function isSimilarRecentComment(comment: string, history: InteractionHistoryRecord[], days = 14) {
  const fingerprint = commentFingerprint(comment);
  if (fingerprint.length < 16) return false;
  return historyWithinDays(history, days).some((item) => {
    if (!item.commentFingerprint) return false;
    if (item.commentFingerprint === fingerprint) return true;
    const overlap = fingerprint.split(" ").filter((token) => token.length > 3 && item.commentFingerprint.includes(token));
    return overlap.length >= Math.min(6, fingerprint.split(" ").filter((token) => token.length > 3).length);
  });
}

export function historySummaryForPrompt(history: InteractionHistoryRecord[], days = 7) {
  const recent = historyWithinDays(history, days);
  if (!recent.length) return "No recent growth interactions recorded.";
  const verified = recent.filter((item) => item.verified);
  const lines = [
    `Recent growth interactions (${recent.length} total, ${verified.length} verified on X):`,
    ...recent.slice(-8).map((item) => `- ${item.date} · ${item.account} · ${item.postUrl} · verified=${item.verified ? "yes" : "no"} · reach=${item.reachScore ?? "n/a"} · comment="${item.comment.slice(0, 90)}"`),
    verified.length
      ? `Verified accounts/threads to prefer similar tone: ${[...new Set(verified.map((item) => item.account))].slice(0, 6).join(", ")}`
      : "No verified interactions yet; stay conservative and avoid repeating recent comment phrasing.",
    `Do not target these post URLs again within ${days} days: ${[...new Set(recent.map((item) => item.postUrl))].slice(0, 8).join(" | ") || "none"}`,
  ];
  return lines.join("\n");
}
