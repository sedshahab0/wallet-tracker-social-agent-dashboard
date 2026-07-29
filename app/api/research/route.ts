import { hasDashboardSession } from "@/lib/auth";
import { generateResearchBridgeActions } from "@/lib/research-bridge";
import { recordFirecrawlUsage } from "@/lib/usage-tracker";

type FirecrawlHit = {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string;
};

type FirecrawlSearchResponse = {
  success?: boolean;
  data?: { web?: FirecrawlHit[]; news?: FirecrawlHit[] };
  web?: FirecrawlHit[];
  news?: FirecrawlHit[];
  error?: string;
};

type ResearchSource = {
  title: string;
  url: string;
  description: string;
};

const jsonHeaders = {
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function scopedQuery(topic: string, scope: string) {
  if (scope === "فقط مستندات رسمی") {
    return `${topic} Wallet Tracker official product documentation`;
  }
  if (scope === "منابع رسمی و وب‌سایت رقبا") {
    return `${topic} crypto wallet tracker competitor product documentation`;
  }
  return `${topic} Wallet Tracker crypto wallet tracking`;
}

function cleanDescription(hit: FirecrawlHit) {
  const value = hit.description || hit.markdown?.replace(/[#*_`>\n]+/g, " ") || "";
  return value.replace(/\s+/g, " ").trim().slice(0, 360);
}

function relevanceScore(source: ResearchSource, topic: string) {
  const hostname = new URL(source.url).hostname.replace(/^www\./, "");
  const blockedHosts = ["instagram.com", "facebook.com", "tiktok.com", "pinterest.com", "huggingface.co"];
  if (blockedHosts.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))) return -100;
  const haystack = `${source.title} ${source.description} ${hostname}`.toLocaleLowerCase();
  const topicTerms = topic.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= 4);
  const productTerms = ["wallet", "crypto", "blockchain", "tracker", "tracking", "security", "کیف", "امنیت", "رمزارز", "رهگیری"];
  const topicMatches = topicTerms.filter((term) => haystack.includes(term)).length;
  const productMatches = productTerms.filter((term) => haystack.includes(term)).length;
  const trustedBoost = hostname === "x.com" || hostname.endsWith("wallettracker.app") ? 4 : 0;
  return topicMatches * 3 + productMatches + trustedBoost;
}

function normalizeSources(payload: FirecrawlSearchResponse, topic: string): ResearchSource[] {
  const hits = [
    ...(payload.data?.web || payload.web || []),
    ...(payload.data?.news || payload.news || []),
  ];
  const seen = new Set<string>();
  return hits.flatMap((hit) => {
    if (!hit.url || seen.has(hit.url)) return [];
    let url: URL;
    try {
      url = new URL(hit.url);
    } catch {
      return [];
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    seen.add(hit.url);
    return [{
      title: hit.title?.trim() || url.hostname,
      url: hit.url,
      description: cleanDescription(hit) || "این منبع برای بررسی مستقیم در فهرست نتایج زنده قرار گرفت.",
    }];
  }).map((source) => ({ source, score: relevanceScore(source, topic) }))
    .filter((entry) => entry.score > -100)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.source)
    .slice(0, 6);
}

function dashboardResearchUrl(request: Request) {
  const base = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() || new URL(request.url).origin;
  try {
    return new URL("/research", base).toString();
  } catch {
    return null;
  }
}

async function notifyTelegram(request: Request, topic: string, sourceCount: number, summary: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  const dashboardUrl = dashboardResearchUrl(request);
  const message: Record<string, unknown> = {
    chat_id: chatId,
    text: `✅ پژوهش هدفمند تکمیل شد\n\nموضوع: ${topic}\nمنابع بررسی‌شده: ${sourceCount}\n\n${summary.slice(0, 650)}`,
  };
  if (dashboardUrl) {
    message.reply_markup = { inline_keyboard: [[{ text: "مشاهده نتیجه پژوهش", url: dashboardUrl }]] };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

async function searchFirecrawl(apiKey: string, query: string) {
  const proxyUrl = process.env.FIRECRAWL_PROXY_URL?.trim();
  const proxySecret = process.env.RESEARCH_PROXY_SECRET?.trim();
  const proxyBearer = process.env.FIRECRAWL_PROXY_BEARER?.trim();
  const endpoint = proxyUrl && proxySecret ? proxyUrl : "https://api.firecrawl.dev/v2/search";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (endpoint === proxyUrl) {
    headers["x-research-proxy-key"] = proxySecret!;
    if (proxyBearer) headers["OAI-Sites-Authorization"] = `Bearer ${proxyBearer}`;
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      sources: ["web"],
      limit: 8,
      ignoreInvalidURLs: true,
      timeout: 45_000,
    }),
    signal: AbortSignal.timeout(55_000),
  }).then(async (response) => {
    await recordFirecrawlUsage("search", response.ok).catch(() => undefined);
    return response;
  });
}

export async function POST(request: Request) {
  if (!(await hasDashboardSession())) {
    return json({ ok: false, error: "نشست شما منقضی شده است؛ دوباره وارد داشبورد شوید." }, 401);
  }

  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    return json({ ok: false, error: "کلید Firecrawl روی سرور تنظیم نشده است." }, 503);
  }

  const body = (await request.json().catch(() => null)) as { topic?: unknown; scope?: unknown } | null;
  const topic = typeof body?.topic === "string" ? body.topic.replace(/\s+/g, " ").trim() : "";
  const scope = typeof body?.scope === "string" ? body.scope.trim() : "منابع رسمی و گفتگوهای عمومی X";
  if (topic.length < 8 || topic.length > 500) {
    return json({ ok: false, error: "موضوع پژوهش باید بین ۸ تا ۵۰۰ نویسه باشد." }, 400);
  }

  try {
    const response = await searchFirecrawl(apiKey, scopedQuery(topic, scope));
    const payload = (await response.json().catch(() => ({}))) as FirecrawlSearchResponse;
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || `Firecrawl پاسخ نامعتبر داد (${response.status}).`);
    }

    const sources = normalizeSources(payload, topic);
    if (!sources.length) throw new Error("برای این موضوع منبع معتبری پیدا نشد؛ عبارت دقیق‌تری وارد کنید.");

    const summary = `Firecrawl برای موضوع «${topic}» تعداد ${sources.length.toLocaleString("fa-IR")} منبع مرتبط پیدا کرد. خلاصه شواهد و لینک مستقیم همه منابع برای بررسی انسانی در داشبورد آماده است.`;
    const result = {
      id: `research-${Date.now()}`,
      score: Math.min(96, 76 + sources.length * 3),
      title: topic,
      meta: `${sources.length.toLocaleString("fa-IR")} منبع مرتبط · دامنه انتخابی: ${scope} · همین حالا`,
      tag: "پژوهش تکمیل‌شده",
      evidence: sources.slice(0, 4).map((source) => `${source.title}: ${source.description}`),
      sources,
      summary,
      completedAt: new Date().toISOString(),
    };

    let telegramNotified = false;
    try {
      telegramNotified = await notifyTelegram(request, topic, sources.length, summary);
    } catch {
      telegramNotified = false;
    }

    let researchBridge = null;
    try {
      researchBridge = await generateResearchBridgeActions({
        topic,
        score: result.score,
        sources,
      });
    } catch {
      researchBridge = null;
    }

    return json({ ok: true, result, telegramNotified, researchBridge });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "پژوهش بیشتر از زمان مجاز طول کشید؛ دوباره تلاش کنید."
      : error instanceof Error ? error.message : "اجرای پژوهش ناموفق بود.";
    return json({ ok: false, error: message }, 502);
  }
}
