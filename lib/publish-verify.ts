import { firecrawlRequest, firecrawlScrapeRaw } from "@/lib/firecrawl";
import { PRODUCT_PROFILE_URL } from "@/lib/project-knowledge";
import { xAccountUsername } from "@/lib/x-api";
import { extractStatusUrls, normalizeComparableText, textLooksPublished } from "@/lib/x-thread";

export type PublishVerifyInput = {
  kind: "post" | "reply" | "interaction";
  text: string;
  targetUrl?: string;
};

export type PublishVerifyResult = {
  verified: boolean;
  matchedUrl: string;
  evidence: string;
  message: string;
};

type MatchCandidate = {
  blob: string;
  links?: string[];
  evidence: string;
  preferUrl?: string;
};

function ownHandlePattern() {
  return new RegExp(`@${xAccountUsername().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
}

function matchPublishedInCandidate(text: string, candidate: MatchCandidate): PublishVerifyResult | null {
  const own = xAccountUsername().toLowerCase();
  const blob = candidate.blob;
  if (!blob.trim()) return null;
  const hasOwnHandle = ownHandlePattern().test(blob);
  const matched =
    textLooksPublished(blob, text) ||
    (hasOwnHandle && textLooksPublished(blob, text.slice(0, 48)));
  if (!matched) return null;
  const matchedUrl =
    extractStatusUrls([blob, ...(candidate.links || [])]).find((url) =>
      url.toLowerCase().includes(`/${own}/status/`),
    ) ||
    candidate.preferUrl ||
    "";
  return {
    verified: true,
    matchedUrl,
    evidence: candidate.evidence,
    message: "انتشار پاسخ در X تأیید شد.",
  };
}

function matchPublishedInCandidates(text: string, candidates: MatchCandidate[]): PublishVerifyResult | null {
  for (const candidate of candidates) {
    const hit = matchPublishedInCandidate(text, candidate);
    if (hit) return hit;
  }
  return null;
}

async function firecrawlWebSearch(query: string) {
  const payload = await firecrawlRequest("search", {
    query,
    sources: ["web"],
    limit: 8,
    ignoreInvalidURLs: true,
    timeout: 45_000,
    scrapeOptions: { formats: ["markdown"], onlyMainContent: true, maxAge: 120_000 },
  });
  return [...(payload.data?.web || payload.web || [])];
}

async function searchOwnTimeline(text: string) {
  const handle = xAccountUsername();
  const snippet = normalizeComparableText(text).split(" ").slice(0, 8).join(" ");
  const query = snippet
    ? `site:x.com/${handle}/status ${snippet}`
    : `site:x.com/${handle}/status`;
  return firecrawlWebSearch(query);
}

async function searchOwnReplyNearThread(text: string, targetUrl: string) {
  const handle = xAccountUsername();
  const snippet = normalizeComparableText(text).split(" ").slice(0, 6).join(" ");
  const parentId = targetUrl.match(/status\/(\d+)/i)?.[1];
  const queries = [
    snippet ? `site:x.com/${handle} ${snippet}` : "",
    parentId && snippet ? `site:x.com/${handle}/status ${parentId} ${snippet}` : "",
    parentId ? `site:x.com/${handle} inreplyto ${parentId}` : "",
  ].filter(Boolean);
  const hits: Array<Record<string, string>> = [];
  for (const query of queries) {
    const batch = await firecrawlWebSearch(query).catch(() => []);
    hits.push(...batch);
    if (hits.length >= 8) break;
  }
  return hits.slice(0, 8);
}

function hitsToCandidates(
  hits: Array<Record<string, string>>,
  evidence: string,
): MatchCandidate[] {
  return hits.map((hit) => ({
    blob: `${hit.title || ""}\n${hit.description || ""}\n${hit.markdown || ""}\n${hit.url || ""}`,
    links: hit.url ? [hit.url] : [],
    evidence,
    preferUrl: extractStatusUrls(hit.url || "")[0],
  }));
}

async function verifyReplyPublication(text: string, targetUrl: string): Promise<PublishVerifyResult> {
  const candidates: MatchCandidate[] = [];

  const [threadScrape, profileScrape] = await Promise.all([
    firecrawlScrapeRaw(targetUrl, { waitFor: 2500, maxAge: 60_000 }).catch(() => null),
    firecrawlScrapeRaw(PRODUCT_PROFILE_URL, { waitFor: 1800, maxAge: 60_000 }).catch(() => null),
  ]);

  if (threadScrape?.data?.markdown) {
    candidates.push({
      blob: threadScrape.data.markdown,
      links: threadScrape.data.links || [],
      evidence: "پاسخ در گفتگوی عمومی X دیده شد.",
      preferUrl: targetUrl,
    });
  }

  if (profileScrape?.data?.markdown) {
    candidates.push({
      blob: profileScrape.data.markdown,
      links: profileScrape.data.links || [],
      evidence: "پاسخ روی تایم‌لاین عمومی اکانت دیده شد.",
    });
  }

  const direct = matchPublishedInCandidates(text, candidates);
  if (direct) return direct;

  const timelineHits = await searchOwnTimeline(text).catch(() => []);
  const timelineMatch = matchPublishedInCandidates(
    text,
    hitsToCandidates(timelineHits, "پاسخ از طریق جست‌وجوی Firecrawl روی تایم‌لاین اکانت پیدا شد."),
  );
  if (timelineMatch) return timelineMatch;

  const contextualHits = await searchOwnReplyNearThread(text, targetUrl).catch(() => []);
  const contextualMatch = matchPublishedInCandidates(
    text,
    hitsToCandidates(contextualHits, "پاسخ از طریق جست‌وجوی Firecrawl در کنار گفتگوی هدف پیدا شد."),
  );
  if (contextualMatch) return contextualMatch;

  return {
    verified: false,
    matchedUrl: "",
    evidence: "",
    message: "پاسخ هنوز روی گفتگوی عمومی دیده نشد؛ چند دقیقه بعد دوباره بررسی کنید.",
  };
}

async function verifyInteractionPublication(text: string, targetUrl: string): Promise<PublishVerifyResult> {
  const candidates: MatchCandidate[] = [];

  const threadScrape = await firecrawlScrapeRaw(targetUrl, { waitFor: 2500, maxAge: 60_000 }).catch(() => null);
  if (threadScrape?.data?.markdown) {
    candidates.push({
      blob: threadScrape.data.markdown,
      links: threadScrape.data.links || [],
      evidence: "کامنت در گفتگوی هدف دیده شد.",
      preferUrl: targetUrl,
    });
  }

  const direct = matchPublishedInCandidates(text, candidates);
  if (direct) {
    return { ...direct, message: "کامنت تعامل در X تأیید شد." };
  }

  const timelineHits = await searchOwnTimeline(text).catch(() => []);
  const timelineMatch = matchPublishedInCandidates(
    text,
    hitsToCandidates(timelineHits, "کامنت از طریق جست‌وجوی Firecrawl روی اکانت پیدا شد."),
  );
  if (timelineMatch) {
    return { ...timelineMatch, message: "کامنت تعامل در X تأیید شد." };
  }

  const contextualHits = await searchOwnReplyNearThread(text, targetUrl).catch(() => []);
  const contextualMatch = matchPublishedInCandidates(
    text,
    hitsToCandidates(contextualHits, "کامنت در کنار گفتگوی هدف پیدا شد."),
  );
  if (contextualMatch) {
    return { ...contextualMatch, message: "کامنت تعامل در X تأیید شد." };
  }

  return {
    verified: false,
    matchedUrl: "",
    evidence: "",
    message: "کامنت هنوز در گفتگوی هدف دیده نشد؛ چند دقیقه بعد دوباره بررسی کنید.",
  };
}

export async function verifyPublication(input: PublishVerifyInput): Promise<PublishVerifyResult> {
  const text = input.text.trim();
  if (text.length < 12) {
    return { verified: false, matchedUrl: "", evidence: "", message: "متن برای راستی‌آزمایی خیلی کوتاه است." };
  }

  if (input.kind === "reply") {
    const target = input.targetUrl?.trim() || "";
    if (!/^https:\/\/(?:www\.)?x\.com\//i.test(target)) {
      return { verified: false, matchedUrl: "", evidence: "", message: "لینک گفتگوی هدف برای تأیید پاسخ معتبر نیست." };
    }
    return verifyReplyPublication(text, target);
  }

  if (input.kind === "interaction") {
    const target = input.targetUrl?.trim() || "";
    if (!/^https:\/\/(?:www\.)?x\.com\/[^/]+\/status\/\d+/i.test(target)) {
      return { verified: false, matchedUrl: "", evidence: "", message: "لینک پست هدف برای تأیید کامنت معتبر نیست." };
    }
    return verifyInteractionPublication(text, target);
  }

  const profile = await firecrawlScrapeRaw(PRODUCT_PROFILE_URL, { waitFor: 1800, maxAge: 60_000 });
  const profileMarkdown = profile.data?.markdown || "";
  if (textLooksPublished(profileMarkdown, text)) {
    const matchedUrl = extractStatusUrls([profileMarkdown, ...(profile.data?.links || [])])
      .find((url) => url.toLowerCase().includes(`/${xAccountUsername().toLowerCase()}/status/`)) || PRODUCT_PROFILE_URL;
    return {
      verified: true,
      matchedUrl,
      evidence: "متن پست روی تایم‌لاین عمومی اکانت دیده شد.",
      message: "انتشار پست در صفحه اکانت تأیید شد.",
    };
  }

  const hits = await searchOwnTimeline(text).catch(() => []);
  for (const hit of hits) {
    const blob = `${hit.title || ""}\n${hit.description || ""}\n${hit.markdown || ""}\n${hit.url || ""}`;
    if (!textLooksPublished(blob, text)) continue;
    const matchedUrl = extractStatusUrls(hit.url || blob)[0] || PRODUCT_PROFILE_URL;
    return {
      verified: true,
      matchedUrl,
      evidence: "متن پست از طریق جست‌وجوی عمومی Firecrawl روی اکانت پیدا شد.",
      message: "انتشار پست در X تأیید شد.",
    };
  }

  return {
    verified: false,
    matchedUrl: "",
    evidence: "",
    message: "پست هنوز روی صفحه عمومی اکانت دیده نشد؛ اگر همین الان منتشر کرده‌اید کمی بعد دوباره بررسی کنید.",
  };
}
