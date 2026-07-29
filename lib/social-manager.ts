import { collectOwnAccountState } from "@/lib/account-state";
import { cleanFirecrawlText, firecrawlRequest, firecrawlScrapeRaw, type FirecrawlHit } from "@/lib/firecrawl";
import {
  PRODUCT_PROFILE_URL,
  PRODUCT_WEBSITE_URL,
  PROJECT_CONTEXT_GENERATED_AT,
  PROJECT_CONTEXT_REVISION,
  VERIFIED_PROJECT_SOURCE,
} from "@/lib/project-knowledge";
import type { AccountState, DailyManagerPlan, LiveSource } from "@/lib/social-manager-types";
import { xaiChatCompletion } from "@/lib/xai";
import { extractStatusUrls, normalizeXUrl } from "@/lib/x-thread";
import { xAccountUsername } from "@/lib/x-api";

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

function hitToSource(hit: FirecrawlHit, channel: LiveSource["channel"]): LiveSource | null {
  if (!hit.url) return null;
  const description = cleanFirecrawlText(hit.description || hit.markdown || hit.title || "");
  if (description.length < 35) return null;
  return { title: hit.title?.trim() || new URL(hit.url).hostname, url: hit.url, description, channel };
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
    .flatMap((hit) => {
      const source = hitToSource(hit, channel);
      return source ? [source] : [];
    });
}

async function firecrawlScrape(url: string, channel: LiveSource["channel"]): Promise<LiveSource[]> {
  const payload = await firecrawlScrapeRaw(url);
  const markdown = cleanFirecrawlText(payload.data?.markdown || "");
  if (!markdown) return [];
  return [{
    title: payload.data?.metadata?.title || new URL(url).hostname,
    url: payload.data?.metadata?.sourceURL || url,
    description: markdown,
    channel,
  }];
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

function preferCanonicalStatusUrl(url: string, description = "") {
  const fromDesc = extractStatusUrls(description)[0];
  const fromUrl = extractStatusUrls(url)[0];
  return fromUrl || fromDesc || normalizeXUrl(url) || normalizeUrl(url);
}

export async function collectLiveSources(date: string, focus = "") {
  const own = xAccountUsername();
  const account = await collectOwnAccountState().catch(async () => {
    const fallback: AccountState = {
      handle: `@${own}`,
      stage: "bootstrap",
      profileUrl: PRODUCT_PROFILE_URL,
      recentPosts: [],
      summaryFa: "وضعیت زنده اکانت در این دور خوانده نشد؛ تصمیم‌گیری محافظه‌کارانه.",
      scrapedAt: new Date().toISOString(),
    };
    return { state: fallback, sources: [] as LiveSource[] };
  });

  const queries = [
    firecrawlScrape(PRODUCT_WEBSITE_URL, "product"),
    firecrawlSearch(`site:x.com/${own}/status`, "account", { limit: 8, hydrate: true }),
    firecrawlSearch('site:x.com/*/status ("wallet security" OR "wallet drainer" OR "seed phrase" OR "whale alert" OR "on-chain alert") -giveaway -airdrop', "x", { limit: 12, tbs: "qdr:w", hydrate: true }),
    firecrawlSearch('site:x.com/*/status ("metamask" OR "ledger" OR "trezor" OR "wallet tracker" OR "portfolio tracker" OR "transaction alert") -giveaway -airdrop', "x", { limit: 10, tbs: "qdr:w", hydrate: true }),
    firecrawlSearch('site:x.com/*/status ("crypto wallet" OR "blockchain analytics" OR "onchain monitoring" OR "wallet monitoring") -airdrop -giveaway', "competitor", { limit: 12, tbs: "qdr:w", hydrate: true }),
    firecrawlSearch(`site:x.com/*/status ("Wallet Tracker" OR wallettracker OR @${own}) -giveaway -airdrop`, "x", { limit: 8, tbs: "qdr:w", hydrate: true }),
    firecrawlSearch("crypto wallet monitoring OR on-chain wallet analytics OR transaction alert product competitor", "competitor", { limit: 8, tbs: "qdr:m", hydrate: true, sources: ["news", "web"] }),
    firecrawlSearch(`crypto wallet monitoring transaction alert product news ${date}`, "news", { limit: 8, tbs: "qdr:w", hydrate: true, sources: ["news", "web"] }),
    firecrawlSearch("site:wallettracker.app Wallet Tracker", "product", { limit: 6, hydrate: true }),
    ...(focus.trim().length >= 8 ? [
      firecrawlSearch(`${focus.trim()} Wallet Tracker crypto wallet`, "news", { limit: 8, tbs: "qdr:m", hydrate: true, sources: ["news", "web"] }),
      firecrawlSearch(`site:x.com/*/status ${focus.trim()} -giveaway -airdrop`, "x", { limit: 8, tbs: "qdr:m", hydrate: true }),
    ] : []),
  ];
  const settled = await Promise.allSettled(queries);
  const seen = new Set<string>();
  const sources = [VERIFIED_PROJECT_SOURCE, ...account.sources, ...settled.flatMap((item) => item.status === "fulfilled" ? item.value : [])]
    .map((source) => source.channel === "x" || source.channel === "account"
      ? { ...source, url: preferCanonicalStatusUrl(source.url, source.description) || source.url }
      : source)
    .filter((source) => {
      const key = normalizeUrl(source.url) || source.url;
      if (seen.has(key) || source.description.length < 35) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 48);
  if (sources.length < 4) throw new Error("منابع زنده کافی برای ساخت برنامه قابل اعتماد پیدا نشد.");
  return { sources, accountState: account.state };
}

function sourceContext(sources: LiveSource[]) {
  return sources.map((source, index) => `${index + 1}. [${source.channel}] ${source.title}\nURL: ${source.url}\n${source.description}`).join("\n\n");
}

function evidenceBoundPlan(
  generated: Omit<DailyManagerPlan, "date" | "generatedAt" | "mode" | "sources" | "accountState" | "contextRevision" | "contextGeneratedAt">,
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
    const account = interaction.account.startsWith("@") ? interaction.account : `@${interaction.account.replace(/^@/, "")}`;
    if (!postUrl || (source?.channel !== "x" && source?.channel !== "competitor") || unsafeTarget || genericComment || !/^https:\/\/(?:www\.)?x\.com\/[^/]+\/status\/\d+/.test(postUrl)) return [];
    return [{ ...interaction, account, postUrl }];
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

export async function buildDailyPlan(
  date: string,
  sources: LiveSource[],
  accountState: AccountState,
  focus = "",
  interactionHistoryContext = "",
  researchBridgeContext = "",
  accountIntelligenceContext = "",
): Promise<DailyManagerPlan> {
  const recentPosts = accountState.recentPosts.map((post, index) => `${index + 1}. ${post.postedAt || "unknown time"} · ${post.url}\n${post.text}`).join("\n\n") || "none discoverable";
  const raw = await xaiChatCompletion({
    system: `You are the full-service X brand manager for Wallet Tracker. The complete [project] source is the binding project-truth document and includes an explicit confidence table, network truth table, safety rules, content policy, and interaction policy. Follow it exactly. Produce a safe, evidence-based daily operating plan for a non-expert human operator. All operator instructions and explanations must be Persian. Public posts and comments should normally be natural English unless the target post is another language. Never invent product capabilities, metrics, partnerships, transactions, networks, availability, news, customer stories, or release dates. Treat [project] as audited first-party facts and all other sources as live public context. Every factual post must cite only supplied source URLs. Keep each X post at most 260 characters. Do not recommend mass following, repetitive comments, engagement bait, financial advice, automated posting, or any X API discovery request. Customer-facing posts must lead with user value and clear outcomes; never mention frameworks, repositories, backend architecture, internal providers or implementation details unless the requested topic is explicitly technical. Use the live own-account state to decide cadence: bootstrap = one truthful intro post; early = light educational posts that do not repeat the exact previous post text; active = continue themes without duplicating recent posts. Pause only when even first-party evidence is insufficient or a real safety risk exists. Schedule 1-2 quality posts maximum and 2-4 meaningful interactions. Prefer interaction targets from large, high-visibility crypto/wallet accounts (exchanges, on-chain analytics, wallet security alerts, major ecosystem accounts) when the supplied sources include them. An interaction is valid only when it points to an exact supplied X status URL (https://x.com/{handle}/status/{id}) and adds a concrete insight or useful question before any product mention. The account field must be the real @handle from that URL. Never exploit a security incident for promotion. Every image prompt must be 16:9, premium black/orange Wallet Tracker visual, directly related to the exact post, no logos of other companies and no tiny text.`,
    user: `Date: ${date}\nRequested editorial focus: ${focus.trim() || "none; choose from evidence"}\n\nRecent growth interaction outcomes (avoid duplicate targets/comments):\n${interactionHistoryContext.trim() || "none recorded"}\n\n${accountIntelligenceContext.trim() || "Account intelligence unavailable."}\n\nPending research-to-action bridge (use when evidence supports it; never invent URLs):\n${researchBridgeContext.trim() || "No pending research bridge actions."}\n\nOwn X account state:\nhandle: ${accountState.handle}\nstage: ${accountState.stage}\nsummary: ${accountState.summaryFa}\nrecent public posts:\n${recentPosts}\n\nLive sources collected by Firecrawl:\n${sourceContext(sources)}`,
    schemaName: "wallet_tracker_daily_plan",
    schema: managerSchema,
    timeoutMs: 120_000,
  });
  const generated = JSON.parse(raw) as Omit<DailyManagerPlan, "date" | "generatedAt" | "mode" | "sources" | "accountState" | "contextRevision" | "contextGeneratedAt">;
  const verified = evidenceBoundPlan(generated, sources);
  return {
    ...verified,
    date,
    generatedAt: new Date().toISOString(),
    contextRevision: PROJECT_CONTEXT_REVISION,
    contextGeneratedAt: PROJECT_CONTEXT_GENERATED_AT,
    mode: "live",
    accountState,
    sources,
  };
}

export async function notifyDailyPlan(request: Request, plan: DailyManagerPlan) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;
  const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() || new URL(request.url).origin;
  const message = `🧭 برنامه هوشمند امروز آماده شد\n\n${plan.headline}\nوضعیت اکانت: ${plan.accountState.stage}\nهدف امروز: ${plan.todayGoal}\nکارها: ${plan.tasks.length}\nپست‌ها: ${plan.posts.length}\nتعامل‌های پیشنهادی: ${plan.interactions.length}`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, reply_markup: { inline_keyboard: [[{ text: "بازکردن برنامه امروز", url: new URL("/", dashboardBase).toString() }]] } }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}
