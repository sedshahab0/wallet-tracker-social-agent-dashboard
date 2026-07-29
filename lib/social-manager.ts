import type { DailyManagerPlan, LiveSource } from "@/lib/social-manager-types";
import {
  PRODUCT_PROFILE_URL,
  PRODUCT_WEBSITE_URL,
  PROJECT_CONTEXT_GENERATED_AT,
  PROJECT_CONTEXT_REVISION,
  VERIFIED_PROJECT_SOURCE,
} from "@/lib/project-knowledge";

type FirecrawlHit = { title?: string; url?: string; description?: string; markdown?: string };
type FirecrawlPayload = {
  success?: boolean;
  data?: { web?: FirecrawlHit[]; news?: FirecrawlHit[]; markdown?: string; metadata?: { title?: string; sourceURL?: string } };
  web?: FirecrawlHit[];
  news?: FirecrawlHit[];
  error?: string;
};
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
          comment: { type: "string", maxLength: 240 }, language: { type: "string" }, risk: { type: "string", enum: ["green", "yellow", "red"] },
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
  return (hit.description || hit.markdown || "").replace(/[#*_\`>\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 1800);
}

function firecrawlTransport() {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) throw new Error("کلید Firecrawl تنظیم نشده است.");
  const proxyUrl = process.env.FIRECRAWL_PROXY_URL?.trim();
  const proxySecret = process.env.RESEARCH_PROXY_SECRET?.trim();
  const proxyBearer = process.env.FIRECRAWL_PROXY_BEARER?.trim();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (proxyUrl && proxySecret) {
    headers["x-research-proxy-key"] = proxySecret;
    if (proxyBearer) headers["OAI-Sites-Authorization"] = `Bearer ${proxyBearer}`;
    return { endpoint: proxyUrl, headers, proxied: true };
  }
  headers.authorization = `Bearer ${apiKey}`;
  return { endpoint: "https://api.firecrawl.dev/v2", headers, proxied: false };
}

async function firecrawlRequest(operation: "search" | "scrape", body: Record<string, unknown>) {
  const transport = firecrawlTransport();
  const endpoint = transport.proxied ? transport.endpoint : `${transport.endpoint}/${operation}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: transport.headers,
    body: JSON.stringify(transport.proxied ? { operation, ...body } : body),
    signal: AbortSignal.timeout(55_000),
  });
  const payload = (await response.json().catch(() => ({}))) as FirecrawlPayload;
  if (!response.ok || payload.success === false) throw new Error(payload.error || `Firecrawl ${operation} error (${response.status})`);
  return payload;
}

async function firecrawlSearch(
  query: string,
  channel: LiveSource["channel"],
  options: { limit?: number; tbs?: string; hydrate?: boolean; sources?: Array<"web" | "news"> } = {},
): Promise<LiveSource[]> {
  const payload = await firecrawlRequest("search", {
    query,
    sources: options.sources || ["web"],
    limit: options.limit || 5,
    tbs: options.tbs,
    ignoreInvalidURLs: true,
    timeout: 45_000,
    scrapeOptions: options.hydrate ? { formats: ["markdown"], onlyMainContent: true, maxAge: 3_600_000 } : undefined,
  });
  return [...(payload.data?.web || payload.web || []), ...(payload.data?.news || payload.news || [])]
    .flatMap((hit) => hit.url ? [{ title: hit.title?.trim() || new URL(hit.url).hostname, url: hit.url, description: cleanText(hit), channel }] : []);
}

async function firecrawlScrape(url: string, channel: LiveSource["channel"]): Promise<LiveSource[]> {
  const payload = await firecrawlRequest("scrape", {
    url,
    formats: ["markdown", "links"],
    onlyMainContent: true,
    waitFor: 1500,
    blockAds: true,
    removeBase64Images: true,
    maxAge: 900_000,
    timeout: 45_000,
  });
  const markdown = payload.data?.markdown?.replace(/[#*_\`>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 1800) || "";
  if (!markdown) return [];
  return [{ title: payload.data?.metadata?.title || new URL(url).hostname, url: payload.data?.metadata?.sourceURL || url, description: markdown, channel }];
}

export async function collectLiveSources(date: string, focus = "") {
  const queries = [
    firecrawlScrape(PRODUCT_PROFILE_URL, "account"),
    firecrawlScrape(PRODUCT_WEBSITE_URL, "product"),
    firecrawlSearch("site:x.com/wallettrackerH/status wallettrackerH", "account", { limit: 8, hydrate: true }),
    firecrawlSearch('site:x.com/*/status ("wallet security" OR "wallet monitoring" OR "on-chain alerts") -giveaway -airdrop', "x", { limit: 10, tbs: "qdr:w", hydrate: true }),
    firecrawlSearch('site:x.com/*/status ("transaction alerts" OR "wallet tracker") (Solana OR Ethereum OR EVM)', "x", { limit: 10, tbs: "qdr:w", hydrate: true }),
    firecrawlSearch(`crypto wallet monitoring transaction alert product news ${date}`, "news", { limit: 8, tbs: "qdr:w", hydrate: true, sources: ["news", "web"] }),
    firecrawlSearch("on-chain wallet analytics security tools launch update", "competitor", { limit: 8, tbs: "qdr:m", hydrate: true, sources: ["news", "web"] }),
    firecrawlSearch("site:wallettracker.app Wallet Tracker", "product", { limit: 6, hydrate: true }),
    ...(focus.trim().length >= 8 ? [
      firecrawlSearch(`${focus.trim()} Wallet Tracker crypto wallet`, "news", { limit: 8, tbs: "qdr:m", hydrate: true, sources: ["news", "web"] }),
      firecrawlSearch(`site:x.com/*/status ${focus.trim()} -giveaway -airdrop`, "x", { limit: 8, tbs: "qdr:m", hydrate: true }),
    ] : []),
  ];
  const settled = await Promise.allSettled(queries);
  const seen = new Set<string>();
  const sources = [VERIFIED_PROJECT_SOURCE, ...settled.flatMap((item) => item.status === "fulfilled" ? item.value : [])].filter((source) => {
    const key = normalizeUrl(source.url) || source.url;
    if (seen.has(key) || source.description.length < 35) return false;
    seen.add(key);
    return true;
  }).slice(0, 36);
  if (sources.length < 4) throw new Error("منابع زنده کافی برای ساخت برنامه قابل اعتماد پیدا نشد.");
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
    const evidence = source?.description.toLocaleLowerCase() || "";
    const unsafeTarget = /(giveaway|airdrop|referral|seed phrase|private key|guaranteed profit|free token|wallet drainer)/i.test(evidence);
    const genericComment = /^(great|nice|amazing|love this|thanks for sharing|interesting)[!. ]*$/i.test(interaction.comment.trim());
    if (!postUrl || source?.channel !== "x" || unsafeTarget || genericComment || !/^https:\/\/(?:www\.)?x\.com\/[^/]+\/status\/\d+/.test(postUrl)) return [];
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

export async function buildDailyPlan(date: string, sources: LiveSource[], focus = ""): Promise<DailyManagerPlan> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) throw new Error("کلید xAI روی سرور تنظیم نشده است.");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.XAI_TEXT_MODEL?.trim() || "grok-4.3",
      temperature: 0.25,
      messages: [
        { role: "system", content: `You are the full-service X brand manager for Wallet Tracker. The complete [project] source is the binding project-truth document and includes an explicit confidence table, network truth table, safety rules, content policy, and interaction policy. Follow it exactly. Produce a safe, evidence-based daily operating plan for a non-expert human operator. All operator instructions and explanations must be Persian. Public posts and comments should normally be natural English unless the target post is another language. Never invent product capabilities, metrics, partnerships, transactions, networks, availability, news, customer stories, or release dates. Treat [project] as audited first-party facts and all other sources as live public context. Every factual post must cite only supplied source URLs. Keep each X post at most 260 characters. Do not recommend mass following, repetitive comments, engagement bait, financial advice, automated posting, or any X API discovery request. Customer-facing posts must lead with user value and clear outcomes; never mention frameworks, repositories, backend architecture, internal providers or implementation details unless the requested topic is explicitly technical. If the [account] sources show no posts, or no account post is discoverable, this is bootstrap mode: create one truthful introductory post from verified [project] facts instead of pausing merely because external mentions are absent. Pause only when even first-party evidence is insufficient or a real safety risk exists. Schedule 1-2 quality posts maximum and 2-4 meaningful interactions. An interaction is valid only when it points to an exact supplied X status URL and adds a concrete insight or useful question before any product mention. Never exploit a security incident for promotion. Every image prompt must be 16:9, premium black/orange Wallet Tracker visual, directly related to the exact post, no logos of other companies and no tiny text.` },
        { role: "user", content: `Date: ${date}\nRequested editorial focus: ${focus.trim() || "none; choose from evidence"}\n\nLive sources collected by Firecrawl:\n${sourceContext(sources)}` },
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
  return {
    ...verified,
    date,
    generatedAt: new Date().toISOString(),
    contextRevision: PROJECT_CONTEXT_REVISION,
    contextGeneratedAt: PROJECT_CONTEXT_GENERATED_AT,
    mode: "live",
    sources,
  };
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
