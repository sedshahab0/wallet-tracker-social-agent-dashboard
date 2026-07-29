import { xAccountId, xAccountUsername, xGetOwned } from "@/lib/x-api";

type Mention = { id: string; text: string; author_id?: string; created_at?: string; lang?: string };
type XUser = { id: string; name: string; username: string; profile_image_url?: string };
type MentionEnvelope = {
  data?: Mention[];
  includes?: { users?: XUser[] };
  meta?: { newest_id?: string; result_count?: number };
};
type StoredReply = {
  id: string; handle: string; avatar: string; language: string; age: string; sentiment: string;
  risk: "green" | "yellow" | "red"; confidence: number; original: string; translation: string;
  answer: string; answerTranslation: string;
};
type PendingMention = Mention & { user?: XUser };
type InboxState = { sinceId: string; resourceReads: number; budgetAlerts: string[]; replies: StoredReply[]; pending: PendingMention[]; updatedAt: string };

const memory: InboxState = { sinceId: "", resourceReads: 0, budgetAlerts: [], replies: [], pending: [], updatedAt: "" };
const statePath = () => process.env.X_INBOX_STATE_PATH?.trim() || ".wrangler/x/inbox.json";

export async function readXInbox(): Promise<InboxState> {
  try {
    const { readFile } = await import("node:fs/promises");
    return { ...memory, ...JSON.parse(await readFile(statePath(), "utf8")) } as InboxState;
  } catch {
    return { ...memory };
  }
}

async function writeXInbox(state: InboxState) {
  Object.assign(memory, state);
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(statePath()), { recursive: true });
    await writeFile(statePath(), JSON.stringify(state), "utf8");
  } catch {
    // In-memory state remains available on read-only runtimes.
  }
}

const replySchema = {
  type: "object", additionalProperties: false, required: ["replies"], properties: {
    replies: { type: "array", maxItems: 10, items: {
      type: "object", additionalProperties: false,
      required: ["tweetId", "language", "sentiment", "risk", "confidence", "translationFa", "answer", "answerTranslationFa"],
      properties: {
        tweetId: { type: "string" }, language: { type: "string" }, sentiment: { type: "string" },
        risk: { type: "string", enum: ["green", "yellow", "red"] }, confidence: { type: "number", minimum: 0, maximum: 100 },
        translationFa: { type: "string" }, answer: { type: "string" }, answerTranslationFa: { type: "string" },
      },
    } },
  },
} as const;

async function suggestReplies(pending: PendingMention[]) {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) throw new Error("xAI is not configured");
  const input = pending.map((item) => ({ tweetId: item.id, text: item.text, lang: item.lang, author: item.user?.username || "unknown" }));
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.XAI_TEXT_MODEL?.trim() || "grok-4.3",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You draft safe X replies for Wallet Tracker, a product for monitoring public on-chain wallet activity and transaction alerts across Solana and EVM. Detect the exact language of each incoming mention and answer naturally in that same language. Also provide Persian translations for the operator. Never invent features, prices, metrics, partnerships or transaction facts. Never ask for a seed phrase or private key. Security, legal, financial, abusive, or unclear messages must be yellow/red and conservative. Keep answers under 240 characters." },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "wallet_tracker_x_replies", strict: true, schema: replySchema } },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `xAI error (${response.status})`);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("xAI returned no reply suggestions");
  return JSON.parse(content) as { replies: Array<{ tweetId: string; language: string; sentiment: string; risk: "green" | "yellow" | "red"; confidence: number; translationFa: string; answer: string; answerTranslationFa: string }> };
}

async function notifyReplies(request: Request, count: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId || !count) return false;
  const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() || new URL(request.url).origin;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `💬 ${count.toLocaleString("fa-IR")} پاسخ جدید برای بررسی آماده شد.`, reply_markup: { inline_keyboard: [[{ text: "بازکردن صندوق پاسخ‌ها", url: new URL("/replies", dashboardBase).toString() }]] } }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

async function notifyBudget(request: Request, label: string, resourceReads: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;
  const spent = (resourceReads * 0.001).toFixed(2);
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `⚠️ هشدار بودجه X: ${label}\nمصرف تخمینی Owned Reads: $${spent} از $5.00` }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

export async function pollOwnedMentions(request: Request) {
  let state = await readXInbox();
  if (state.resourceReads >= 5_000) return { state, newReplies: 0, stopped: true, telegramNotified: false };
  const params = new URLSearchParams({ max_results: "10", "tweet.fields": "author_id,created_at,lang", expansions: "author_id", "user.fields": "id,name,username,profile_image_url" });
  if (state.sinceId) params.set("since_id", state.sinceId);
  const payload = await xGetOwned<MentionEnvelope>(`/2/users/${xAccountId()}/mentions?${params.toString()}`) as MentionEnvelope;
  const users = new Map((payload.includes?.users || []).map((user) => [user.id, user]));
  const known = new Set([...state.replies.map((item) => item.id), ...state.pending.map((item) => item.id)]);
  const fresh = (payload.data || []).filter((item) => !known.has(item.id)).map((item) => ({ ...item, user: item.author_id ? users.get(item.author_id) : undefined }));
  const previousReads = state.resourceReads;
  const resourceReads = previousReads + fresh.length;
  const crossed = [[2_500, "۵۰٪ بودجه مصرف شد"], [4_000, "۸۰٪ بودجه مصرف شد"], [5_000, "سقف ۵ دلاری؛ پایش متوقف می‌شود"]] as const;
  const newAlerts = crossed.filter(([threshold, label]) => previousReads < threshold && resourceReads >= threshold && !state.budgetAlerts.includes(label));
  state = { ...state, sinceId: payload.meta?.newest_id || state.sinceId, resourceReads, budgetAlerts: [...state.budgetAlerts, ...newAlerts.map(([, label]) => label)], pending: [...state.pending, ...fresh], updatedAt: new Date().toISOString() };
  await writeXInbox(state);
  await Promise.all(newAlerts.map(([, label]) => notifyBudget(request, label, resourceReads).catch(() => false)));
  if (!state.pending.length) return { state, newReplies: 0, stopped: false, telegramNotified: false };
  const suggestions = await suggestReplies(state.pending);
  const byId = new Map(suggestions.replies.map((item) => [item.tweetId, item]));
  const created = state.pending.flatMap((mention) => {
    const suggestion = byId.get(mention.id);
    if (!suggestion) return [];
    const user = mention.user;
    const initials = (user?.name || user?.username || "X").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    return [{ id: mention.id, handle: `@${user?.username || "unknown"}`, avatar: initials, language: suggestion.language, age: "جدید", sentiment: suggestion.sentiment, risk: suggestion.risk, confidence: Math.round(suggestion.confidence), original: mention.text, translation: suggestion.translationFa, answer: suggestion.answer, answerTranslation: suggestion.answerTranslationFa } satisfies StoredReply];
  });
  state = { ...state, replies: [...created, ...state.replies].slice(0, 200), pending: [], updatedAt: new Date().toISOString() };
  await writeXInbox(state);
  const telegramNotified = await notifyReplies(request, created.length).catch(() => false);
  return { state, newReplies: created.length, stopped: false, telegramNotified, account: { id: xAccountId(), username: xAccountUsername() } };
}
