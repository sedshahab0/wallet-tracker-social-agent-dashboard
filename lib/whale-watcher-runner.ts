import { firecrawlRequest } from "@/lib/firecrawl";
import { dashboardUrl, sendTelegramMessage } from "@/lib/telegram-notify";
import { runWhaleWatcher } from "@/lib/whale-watcher";

async function searchWeb(query: string) {
  const payload = await firecrawlRequest("search", {
    query,
    sources: ["web"],
    limit: 8,
    tbs: "qdr:d",
    ignoreInvalidURLs: true,
    timeout: 45_000,
    scrapeOptions: { formats: ["markdown"], onlyMainContent: true, maxAge: 180_000 },
  });
  return [...(payload.data?.web || payload.web || [])];
}

export async function runWhaleWatcherJob(request: Request) {
  const result = await runWhaleWatcher(searchWeb);
  let telegramNotified = 0;
  for (const alert of result.alerts) {
    const sent = await sendTelegramMessage({
      text: `🐋 فرصت Tier ${alert.tier} · Reach ${alert.reachScore}\n${alert.account}\n${alert.topic}\n${alert.engagementLabel || "engagement signal"}\n${alert.postUrl}`,
      buttons: dashboardUrl("/growth", request)
        ? [{ text: "بازکردن برنامه رشد", url: dashboardUrl("/growth", request) }]
        : [],
    }).catch(() => false);
    if (sent) telegramNotified += 1;
  }
  return { ...result, telegramNotified };
}
