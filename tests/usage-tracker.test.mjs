import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function withUsageModule(run) {
  const dir = await mkdtemp(join(tmpdir(), "ai-usage-test-"));
  const previous = process.env.AI_USAGE_STATE_PATH;
  process.env.AI_USAGE_STATE_PATH = join(dir, "ai-usage.json");
  try {
    const mod = await import(`../lib/usage-tracker.ts?test=${Date.now()}-${Math.random()}`);
    await run(mod, process.env.AI_USAGE_STATE_PATH);
  } finally {
    if (previous === undefined) delete process.env.AI_USAGE_STATE_PATH;
    else process.env.AI_USAGE_STATE_PATH = previous;
    await rm(dir, { recursive: true, force: true });
  }
}

test("records xAI chat and image usage into summary totals", async () => {
  await withUsageModule(async ({ recordXaiChatUsage, recordXaiImageUsage, getUsageSummary }) => {
    await recordXaiChatUsage({ promptTokens: 100, completionTokens: 40, totalTokens: 140 });
    await recordXaiChatUsage({ promptTokens: 50, completionTokens: 10 });
    await recordXaiImageUsage();
    const summary = await getUsageSummary();
    assert.equal(summary.xai.chatRequests, 2);
    assert.equal(summary.xai.promptTokens, 150);
    assert.equal(summary.xai.completionTokens, 50);
    assert.equal(summary.xai.totalTokens, 200);
    assert.equal(summary.xai.imageGenerations, 1);
    assert.equal(summary.xai.tokensRemaining, summary.xai.tokenBudget - 200);
  });
});

test("does not lose counters under parallel firecrawl mutations", async () => {
  await withUsageModule(async ({ recordFirecrawlUsage, getUsageSummary }, path) => {
    await Promise.all([
      ...Array.from({ length: 12 }, () => recordFirecrawlUsage("search", true)),
      ...Array.from({ length: 8 }, () => recordFirecrawlUsage("scrape", true)),
      recordFirecrawlUsage("search", false),
    ]);
    const summary = await getUsageSummary();
    assert.equal(summary.firecrawl.searches, 13);
    assert.equal(summary.firecrawl.scrapes, 8);
    assert.equal(summary.firecrawl.failures, 1);
    assert.equal(summary.firecrawl.creditsUsedEstimate, 21);
    const disk = JSON.parse(await readFile(path, "utf8"));
    assert.equal(disk.firecrawl.searches, 13);
    assert.equal(disk.firecrawl.scrapes, 8);
  });
});
