import { isFirecrawlEnabled } from "@/lib/firecrawl";

type ProxyRequest = {
  operation?: unknown;
  url?: unknown;
  query?: unknown;
  sources?: unknown;
  tbs?: unknown;
  scrapeOptions?: unknown;
  limit?: unknown;
  ignoreInvalidURLs?: unknown;
  timeout?: unknown;
};

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  if (!isFirecrawlEnabled()) {
    return Response.json({ success: false, error: "Firecrawl is disabled" }, { status: 503 });
  }

  const expectedSecret = process.env.RESEARCH_PROXY_SECRET?.trim() || "";
  const suppliedSecret = request.headers.get("x-research-proxy-key") || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) return Response.json({ success: false, error: "Firecrawl is not configured" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as ProxyRequest | null;
  const operation = body?.operation === "scrape" ? "scrape" : "search";
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (operation === "scrape") {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("protocol");
    } catch {
      return Response.json({ success: false, error: "Invalid scrape URL" }, { status: 400 });
    }
  }
  if (operation === "search" && (!query || query.length > 700)) {
    return Response.json({ success: false, error: "Invalid search query" }, { status: 400 });
  }

  const response = await fetch(`https://api.firecrawl.dev/v2/${operation}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(operation === "scrape" ? {
      url,
      formats: ["markdown", "links"],
      onlyMainContent: true,
      waitFor: 1500,
      blockAds: true,
      removeBase64Images: true,
      timeout: 45_000,
    } : {
      query,
      sources: Array.isArray(body?.sources) ? body.sources : ["web"],
      tbs: typeof body?.tbs === "string" ? body.tbs : undefined,
      scrapeOptions: body?.scrapeOptions && typeof body.scrapeOptions === "object" ? body.scrapeOptions : undefined,
      limit: Math.min(12, Math.max(1, Number(body?.limit) || 6)),
      ignoreInvalidURLs: true,
      timeout: 45_000,
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const payload = await response.text();
  return new Response(payload, {
    status: response.status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
    },
  });
}
