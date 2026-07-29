import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function withWhaleState(run) {
  const dir = await mkdtemp(join(tmpdir(), "whale-watcher-test-"));
  const previous = process.env.WHALE_WATCHER_STATE_PATH;
  process.env.WHALE_WATCHER_STATE_PATH = join(dir, "whale-watcher.json");
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.WHALE_WATCHER_STATE_PATH;
    else process.env.WHALE_WATCHER_STATE_PATH = previous;
    await rm(dir, { recursive: true, force: true });
  }
}

test("detects tier S whale alerts from firecrawl hits", async () => {
  await withWhaleState(async () => {
    const { runWhaleWatcher } = await import(`../lib/whale-watcher.ts?test=${Date.now()}`);
    const statusId = `${Date.now()}001`;
    const result = await runWhaleWatcher(async () => [
      {
        title: "@WhaleAlert posted a large transfer",
        description: "8.2K likes · 120K views · wallet drainer alert on ethereum public address monitoring",
        url: `https://x.com/WhaleAlert/status/${statusId}`,
        markdown: `https://x.com/WhaleAlert/status/${statusId}`,
      },
      {
        title: "random user",
        description: "nice weather today",
        url: "https://x.com/randomuser/status/999",
      },
    ]);

    assert.equal(result.alerts.length, 1);
    assert.equal(result.alerts[0].account, "@WhaleAlert");
    assert.equal(result.alerts[0].tier, "S");
    assert.ok(result.alerts[0].reachScore >= 65);
    assert.match(result.alerts[0].postUrl, new RegExp(`WhaleAlert/status/${statusId}`));
  });
});

test("deduplicates whale alerts across runs", async () => {
  await withWhaleState(async () => {
    const { runWhaleWatcher } = await import(`../lib/whale-watcher.ts?test=${Date.now()}-dedup`);
    const statusId = `${Date.now()}002`;
    const hit = {
      title: "@WhaleAlert wallet security update",
      description: "8.2K likes · 120K views · wallet security alert on-chain monitoring transaction alert",
      url: `https://x.com/WhaleAlert/status/${statusId}`,
      markdown: `https://x.com/WhaleAlert/status/${statusId}`,
    };
    const first = await runWhaleWatcher(async () => [hit]);
    assert.equal(first.alerts.length, 1);
    const second = await runWhaleWatcher(async () => [hit]);
    assert.equal(second.alerts.length, 0);
    assert.ok(second.state.alertedUrls.length >= 1);
  });
});
