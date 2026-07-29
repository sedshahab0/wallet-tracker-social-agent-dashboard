import type { DailyManagerPlan, LiveSource } from "@/lib/social-manager-types";

type FirecrawlHit = { title?: string; url?: string; description?: string; markdown?: string };
type FirecrawlPayload = { success?: boolean; data?: { web?: FirecrawlHit[] }; web?: FirecrawlHit[]; error?: string };
type ChatPayload = { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };

const managerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "strategy", "todayGoal", "publishDecision", "publishReason", "tasks", "posts", "interactions", "signals"],
  properties: {
    headline: { type: "string" },
    strategy: { type: "string" },
    todayGoal: { type: "string" },
    publishDecision: { type: "string", enum: ["publish", "light", "pause"] },
    publishReason: { type: "string" },
    tasks: {
      type: "array",
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "time", "title", "instruction", "kind", "priority", "risk", "why", "targetUrl"],
        properties: {
          id: { type: "string" }, time: { type: "string" }, title: { type: "string" }, instruction: { type: "string" },
          kind: { type: "string", enum: ["publish", "reply", "interact", "research", "review", "pause"] },
          priority: { type: "string", enum: ["now", "today", "optional"] }, risk: { type: "string", enum: ["green", "yellow", "red"] },
          why: { type: "string" }, targetUrl: { type: "string" },
        },
      },
    },
    posts: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "time", "title", "summaryFa", "copy", "language", "imagePrompt", "risk", "sourceUrls"],
        properties: {
          id: { type: "string" }, time: { type: "string" }, title: { type: "string" }, summaryFa: { type: "string" }, copy: { type: "string" },
          language: { type: "string" }, imagePrompt: { type: "string" }, risk: { type: "string", enum: ["green", "yellow", "red"] },
          sourceUrls: { type: "array", maxItems: 3, items: { type: "string" } },
        },
      },
    },
    interactions: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "time", "account", "postUrl", "reason", "comment", "language", "risk"],
        properties: {
          id: { type: "string" }, time: { type: "string" }, account: { type: "string" }, postUrl: { type: "string" }, reason: { type: "string" },
          comment: { type: "string" }, language: { type: "string" }, risk: { type: "string", enum: ["green", "yellow", "red"] },
        },
      },
    },
    signals: {
      type: "array",
      maxItems: 6,
      items: { type: "object", additionalProperties: false, required: ["title", "insight", "sourceUrl"], properties: { title: { type: "string" }, insight: { type: "string" }, sourceUrl: { type: "string" } } },
    },
  },
} as const;

function cleanText(hit: FirecrawlHit) {
  return (hit.description || hit.markdown || "").replace(/[#*_`>\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

async function firecrawlSearch(query: string, channel: LiveSource["channel"], limit = 5): Promise<LiveSource[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) throw new Error("کلید Firecrawl تنظیم نشده است.");
  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ query, sources: ["web"], limit, ignoreInvalidURLs: true, timeout: 45_000 }),
    signal: AbortSignal.timeout(55_000),
  });
  const payload = (await response.json().catch(() => ({}))) as FirecrawlPayload;
  if (!response.ok || payload.success === false) throw new Error(payload.error || `Firecrawl error (${response.status})`);
  return (payload.data?.web || payload.web || []).flatMap((hit) => hit.url ? [{ title: hit.title?.trim() || new URL(hit.url).hostname, url: hit.url, description: cleanText(hit), channel }] : []);
}

export async function collectLiveSources(date: string) {
  const queries = [
    firecrawlSearch(`site:x.com/*/status/ ("wallet security" OR "on-chain alerts" OR "wallet monitoring") crypto ${date}`, "x", 7),
    firecrawlSearch(`crypto wallet security on-chain monitoring product news ${date}`, "news", 6),
    firecrawlSearch(`("wallettracker.app" OR "Wallet Tracker") on-chain wallet alerts Solana EVM`, "product", 5),
  ];
  const settled = await Promise.allSettled(queries);
  const seen = new Set<string>();
  const sources = settled.flatMap((item) => item.status === "fulfilled" ? item.value : []).filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 16);
  if (sources.length < 3) throw new Error("منابع زنده کافی برای ساخت برنامه قابل اعتماد پیدا نشد.");
  return sources;
}

function sourceContext(sources: LiveSource[]) {
  return sources.map((source, index) => `${index + 1}. [${source.channel}] ${source.title}\nURL: ${source.url}\n${source.description}`).join("\n\n");
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function evidenceBoundPlan(
  generated: Omit<DailyManagerPlan, "date" | "generatedAt" | "mode" | "sources">,
  sources: LiveSource[],
) {
  const allowed = new Map(sources.map((source) => [normalizeUrl(source.url), source]));
  const allowedUrls = new Set(allowed.keys());
  const keepEvidenceUrl = (value: string) => {
    const normalized = normalizeUrl(value);
    return allowedUrls.has(normalized) ? normalized : "";
  };
  const posts = generated.posts.map((post) => {
    const sourceUrls = post.sourceUrls.map(keepEvidenceUrl).filter(Boolean);
    return { ...post, sourceUrls, risk: sourceUrls.length ? post.risk : "yellow" as const };
  });
  const interactions = generated.interactions.flatMap((interaction) => {
    const postUrl = keepEvidenceUrl(interaction.postUrl);
    const source = allowed.get(postUrl);
    if (!postUrl || source?.channel !== "x" || !/^https:\/\/(?:www\.)?x\.com\/[^/]+\/status\/\d+/.test(postUrl)) return [];
    return [{ ...interaction, postUrl }];
  });
  const signals = generated.signals.flatMap((signal) => {
    const sourceUrl = keepEvidenceUrl(signal.sourceUrl);
    return sourceUrl ? [{ ...signal, sourceUrl }] : [];
  });
  const tasks = generated.tasks.map((task) => {
    if (!task.targetUrl) return task;
    if (task.targetUrl.startsWith("/")) return task;
    const targetUrl = keepEvidenceUrl(task.targetUrl);
    return { ...task, targetUrl, risk: targetUrl ? task.risk : "yellow" as const };
  });
  return { ...generated, posts, interactions, signals, tasks };
}

export async function buildDailyPlan(date: string, sources: LiveSource[]): Promise<DailyManagerPlan> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) throw new Error("کلید xAI روی سرور تنظیم نشده است.");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.XAI_TEXT_MODEL?.trim() || "grok-4.3",
      temperature: 0.25,
      messages: [
        { role: "system", content: `You are the full-service X brand manager for Wallet Tracker, a product for real-time public on-chain wallet monitoring and transaction alerts across Solana and EVM. Produce a safe, evidence-based daily operating plan for a non-expert human operator. All operator instructions and explanations must be Persian. Public posts and comments should normally be natural English unless the target post is another language. Never invent product capabilities, metrics, partnerships, transactions, or news. Every factual post must cite source URLs supplied below. Keep each X post at most 260 characters. Do not recommend mass following, repetitive comments, engagement bait, financial advice, or automated posting. Decide to pause publishing if evidence is weak. Schedule 1-2 quality posts maximum and 2-4 meaningful interactions. Every image prompt must be 16:9, premium black/orange Wallet Tracker visual, directly related to the post, no logos of other companies and no tiny text.` },
        { role: "user", content: `Date: ${date}\n\nLive sources collected by Firecrawl:\n${sourceContext(sources)}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "wallet_tracker_daily_plan", strict: true, schema: managerSchema } },
    }),
    signal: AbortSignal.timeout(80_000),
  });
  const payload = (await response.json().catch(() => ({}))) as ChatPayload;
  if (!response.ok) throw new Error(payload.error?.message || `xAI error (${response.status})`);
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new Error("xAI برنامه ساختاریافته‌ای برنگرداند.");
  const generated = JSON.parse(raw) as Omit<DailyManagerPlan, "date" | "generatedAt" | "mode" | "sources">;
  const verified = evidenceBoundPlan(generated, sources);
  return { ...verified, date, generatedAt: new Date().toISOString(), mode: "live", sources };
}

export async function notifyDailyPlan(request: Request, plan: DailyManagerPlan) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;
  const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() || new URL(request.url).origin;
  const message = `🧭 برنامه هوشمند امروز آماده شد\n\n${plan.headline}\nهدف امروز: ${plan.todayGoal}\nکارها: ${plan.tasks.length}\nپست‌ها: ${plan.posts.length}\nتعامل‌های پیشنهادی: ${plan.interactions.length}`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, reply_markup: { inline_keyboard: [[{ text: "بازکردن برنامه امروز", url: new URL("/", dashboardBase).toString() }]] } }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}
