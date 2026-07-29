import { buildAccountIntelligence } from "@/lib/account-intelligence";
import { cleanFirecrawlText, firecrawlRequest, firecrawlScrapeRaw } from "@/lib/firecrawl";
import { PRODUCT_PROFILE_URL } from "@/lib/project-knowledge";
import type { AccountState, LiveSource } from "@/lib/social-manager-types";
import { xAccountUsername } from "@/lib/x-api";
import {
  accountStageFromPosts,
  extractStatusUrls,
  parseOwnRecentPosts,
} from "@/lib/x-thread";

export async function collectOwnAccountState(): Promise<{ state: AccountState; sources: LiveSource[] }> {
  const handle = `@${xAccountUsername()}`;
  const profile = await firecrawlScrapeRaw(PRODUCT_PROFILE_URL, { waitFor: 2000, maxAge: 300_000 });
  const markdown = profile.data?.markdown || "";
  const links = profile.data?.links || [];
  const recentPosts = parseOwnRecentPosts(markdown, links);
  let enriched = recentPosts;

  if (!enriched.length) {
    const search = await firecrawlRequest("search", {
      query: `site:x.com/${xAccountUsername()}/status`,
      sources: ["web"],
      limit: 8,
      ignoreInvalidURLs: true,
      timeout: 45_000,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true, maxAge: 600_000 },
    }).catch(() => null);
    const hits = [...(search?.data?.web || search?.web || [])];
    enriched = hits.flatMap((hit) => {
      const url = extractStatusUrls(hit.url || "")[0];
      if (!url) return [];
      return [{
        id: url.match(/status\/(\d+)/)?.[1] || "",
        url,
        text: cleanFirecrawlText(hit.description || hit.markdown || hit.title || "", 240),
        postedAt: "",
      }];
    }).filter((post) => post.id && post.text).slice(0, 8);
  }

  const stage = accountStageFromPosts(enriched.length);
  const summaryFa = stage === "bootstrap"
    ? "اکانت رسمی هنوز پست عمومی قابل‌کشف ندارد؛ حالت راه‌اندازی برند."
    : stage === "early"
      ? `اکانت رسمی در مرحله ابتدایی است و ${enriched.length.toLocaleString("fa-IR")} پست عمومی اخیر دارد.`
      : `اکانت رسمی فعال است؛ ${enriched.length.toLocaleString("fa-IR")} پست اخیر برای تصمیم‌گیری روزانه خوانده شد.`;

  const intelligence = await buildAccountIntelligence(markdown, enriched);
  const state: AccountState = {
    handle,
    stage,
    profileUrl: PRODUCT_PROFILE_URL,
    recentPosts: enriched,
    summaryFa: `${summaryFa} · ${intelligence.summaryFa}`,
    scrapedAt: new Date().toISOString(),
    intelligenceSummaryFa: intelligence.summaryFa,
    engagementTrend: intelligence.engagementTrend,
  };

  const sources: LiveSource[] = [
    {
      title: `وضعیت زنده اکانت ${handle}`,
      url: PRODUCT_PROFILE_URL,
      channel: "account",
      description: [
        summaryFa,
        `stage=${stage}`,
        ...enriched.map((post, index) => `${index + 1}. ${post.postedAt || "زمان نامشخص"} · ${post.url} · ${post.text}`),
      ].join("\n").slice(0, 3500),
    },
    ...enriched.map((post) => ({
      title: `پست اخیر ${handle}`,
      url: post.url,
      channel: "account" as const,
      description: cleanFirecrawlText(`${post.postedAt} ${post.text}`, 900),
    })),
  ];

  return { state, sources };
}
