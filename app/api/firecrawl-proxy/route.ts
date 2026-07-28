type ProxyRequest = {
  query?: unknown;
  sources?: unknown;
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
  const expectedSecret = process.env.RESEARCH_PROXY_SECRET?.trim() || "";
  const suppliedSecret = request.headers.get("x-research-proxy-key") || "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) return Response.json({ success: false, error: "Firecrawl is not configured" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as ProxyRequest | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query || query.length > 700) {
    return Response.json({ success: false, error: "Invalid search query" }, { status: 400 });
  }

  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      sources: ["web"],
      limit: Math.min(8, Math.max(1, Number(body?.limit) || 6)),
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
