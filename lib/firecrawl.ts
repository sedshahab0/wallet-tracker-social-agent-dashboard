import { recordFirecrawlUsage } from "@/lib/usage-tracker";

export type FirecrawlHit = {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string;
};

export type FirecrawlPayload = {
  success?: boolean;
  data?: {
    web?: FirecrawlHit[];
    news?: FirecrawlHit[];
    markdown?: string;
    links?: string[];
    metadata?: { title?: string; sourceURL?: string; description?: string };
  };
  web?: FirecrawlHit[];
  news?: FirecrawlHit[];
  error?: string;
};

export function firecrawlTransport() {
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

export async function firecrawlRequest(operation: "search" | "scrape", body: Record<string, unknown>) {
  const transport = firecrawlTransport();
  const endpoint = transport.proxied ? transport.endpoint : `${transport.endpoint}/${operation}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: transport.headers,
    body: JSON.stringify(transport.proxied ? { operation, ...body } : body),
    signal: AbortSignal.timeout(55_000),
  });
  const payload = (await response.json().catch(() => ({}))) as FirecrawlPayload;
  if (!response.ok || payload.success === false) {
    await recordFirecrawlUsage(operation, false);
    throw new Error(payload.error || `Firecrawl ${operation} error (${response.status})`);
  }
  await recordFirecrawlUsage(operation, true);
  return payload;
}

export async function firecrawlScrapeRaw(url: string, options: { waitFor?: number; maxAge?: number; timeout?: number } = {}) {
  return firecrawlRequest("scrape", {
    url,
    formats: ["markdown", "links"],
    onlyMainContent: true,
    waitFor: options.waitFor ?? 1500,
    blockAds: true,
    removeBase64Images: true,
    maxAge: options.maxAge ?? 900_000,
    timeout: options.timeout ?? 45_000,
  });
}

export function cleanFirecrawlText(value: string, max = 1800) {
  return value.replace(/\\(.)/g, "$1").replace(/[#*_`>\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
