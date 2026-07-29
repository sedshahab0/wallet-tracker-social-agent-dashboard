import assert from "node:assert/strict";
import test from "node:test";
import {
  extractEngagementSignals,
  scoreEngagement,
  scoreInteraction,
  scoreTopicRelevance,
} from "../lib/interaction-score-core.ts";
import {
  lookupRegistryEntry,
  tierBaseScore,
  tierFromFollowerCount,
} from "../lib/influence-registry.ts";

test("recognizes known crypto influence accounts", () => {
  assert.equal(lookupRegistryEntry("@WhaleAlert")?.tier, "S");
  assert.equal(lookupRegistryEntry("https://x.com/MetaMask/status/1")?.tier, "A");
  assert.equal(tierFromFollowerCount(600_000), "S");
  assert.equal(tierFromFollowerCount(80_000), "A");
  assert.equal(tierBaseScore("S"), 30);
});

test("extracts likes, views and followers from scraped markdown", () => {
  const signals = extractEngagementSignals(`
    @WhaleAlert posted 2 hours ago
    8.2K likes · 120K views · 430 reposts
    2.5M followers
  `);
  assert.equal(signals.likes, 8200);
  assert.equal(signals.views, 120_000);
  assert.equal(signals.reposts, 430);
  assert.equal(signals.followers, 2_500_000);
  assert.ok(scoreEngagement(signals) >= 12);
});

test("scores wallet-security threads higher than unrelated topics", () => {
  const wallet = scoreTopicRelevance("wallet drainer alert on ethereum public address monitoring");
  const random = scoreTopicRelevance("nice weather today in the city park");
  assert.ok(wallet > random);
});

test("ranks whale-alert style interactions above small unrelated accounts", () => {
  const whale = scoreInteraction({
    interaction: {
      id: "1",
      time: "10:00",
      account: "@WhaleAlert",
      postUrl: "https://x.com/WhaleAlert/status/123",
      reason: "Large ETH transfer discussion",
      comment: "Public address tracking helps separate noise from meaningful flow.",
      language: "English",
      risk: "green",
    },
    sourceText: "8.2K likes · wallet security · on-chain alert · 2 hours ago",
    threadText: "WhaleAlert posted: 8.2K likes 120K views ethereum transfer",
  });

  const small = scoreInteraction({
    interaction: {
      id: "2",
      time: "11:00",
      account: "@randomuser",
      postUrl: "https://x.com/randomuser/status/456",
      reason: "Generic mention",
      comment: "Interesting point about crypto.",
      language: "English",
      risk: "green",
    },
    sourceText: "random user posted yesterday about lunch",
    threadText: "randomuser: had a good day",
  });

  assert.equal(whale.tier, "S");
  assert.ok(whale.reachScore >= 70);
  assert.ok(whale.reachScore > small.reachScore);
  assert.match(whale.scoreReasonFa, /اولویت بالا|Reach/);
});
