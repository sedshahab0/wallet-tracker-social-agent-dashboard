import { firecrawlRequest, firecrawlScrapeRaw, isFirecrawlEnabled } from "@/lib/firecrawl";
import { PRODUCT_PROFILE_URL } from "@/lib/project-knowledge";
import { xAccountUsername } from "@/lib/x-api";
import { extractStatusUrls, normalizeComparableText, textLooksPublished } from "@/lib/x-thread";

export type PublishVerifyInput = {
  kind: "post" | "reply";
  text: string;
  targetUrl?: string;
};

export type PublishVerifyResult = {
  verified: boolean;
  matchedUrl: string;
  evidence: string;
  message: string;
};

async function searchOwnTimeline(text: string) {
  const handle = xAccountUsername();
  const snippet = normalizeComparableText(text).split(" ").slice(0, 8).join(" ");
  const query = snippet
    ? `site:x.com/${handle}/status ${snippet}`
    : `site:x.com/${handle}/status`;
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

export async function verifyPublication(input: PublishVerifyInput): Promise<PublishVerifyResult> {
  const text = input.text.trim();
  if (text.length < 12) {
    return { verified: false, matchedUrl: "", evidence: "", message: "متن برای راستی‌آزمایی خیلی کوتاه است." };
  }
  if (!isFirecrawlEnabled()) {
    return {
      verified: false,
      matchedUrl: "",
      evidence: "",
      message: "راستی‌آزمایی Firecrawl خاموش است؛ انتشار را دستی در X بررسی کنید.",
    };
  }

  if (input.kind === "reply") {
    const target = input.targetUrl?.trim() || "";
    if (!/^https:\/\/(?:www\.)?x\.com\//i.test(target)) {
      return { verified: false, matchedUrl: "", evidence: "", message: "لینک گفتگوی هدف برای تأیید پاسخ معتبر نیست." };
    }
    const scraped = await firecrawlScrapeRaw(target, { waitFor: 1800, maxAge: 60_000 });
    const markdown = scraped.data?.markdown || "";
    const own = xAccountUsername().toLowerCase();
    const hasOwnHandle = new RegExp(`@${own}\\b`, "i").test(markdown);
    const matched = textLooksPublished(markdown, text) || (hasOwnHandle && textLooksPublished(markdown, text.slice(0, 48)));
    const matchedUrl = extractStatusUrls([markdown, ...(scraped.data?.links || [])]).find((url) => url.toLowerCase().includes(`/${own}/status/`)) || target;
    return {
      verified: matched,
      matchedUrl: matched ? matchedUrl : "",
      evidence: matched ? "پاسخ در گفتگوی عمومی X دیده شد." : "هنوز پاسخ ما در گفتگوی عمومی پیدا نشد.",
      message: matched ? "انتشار پاسخ در X تأیید شد." : "پاسخ هنوز روی گفتگوی عمومی دیده نشد؛ چند دقیقه بعد دوباره بررسی کنید.",
    };
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
