import assert from "node:assert/strict";
import test from "node:test";
import {
  accountStageFromPosts,
  extractHandle,
  extractStatusUrls,
  statusUrlFor,
  textLooksPublished,
} from "../lib/x-thread.ts";

test("extracts X handles and canonical status URLs from Firecrawl markdown", () => {
  const markdown = `# Post by @123SshH321
Author: SH @123SshH321
URL: [https://x.com/123SshH321/status/2082442079662223721](https://x.com/123SshH321/status/2082442079662223721)
> are you supporting eth ?
`;
  assert.equal(extractHandle(markdown, "2082442079662223721"), "@123SshH321");
  assert.deepEqual(extractStatusUrls(markdown), ["https://x.com/123SshH321/status/2082442079662223721"]);
  assert.equal(statusUrlFor("@123SshH321", "2082442079662223721"), "https://x.com/123SshH321/status/2082442079662223721");
});

test("classifies own-account stage from public post count", () => {
  assert.equal(accountStageFromPosts(0), "bootstrap");
  assert.equal(accountStageFromPosts(2), "early");
  assert.equal(accountStageFromPosts(8), "active");
});

test("matches published text with high token overlap", () => {
  const haystack = "Wallet Tracker helps you monitor cryptocurrency wallets using public blockchain activity. Track wallets, receive real-time transaction alerts.";
  assert.equal(textLooksPublished(haystack, "Wallet Tracker helps you monitor cryptocurrency wallets using public blockchain activity"), true);
  assert.equal(textLooksPublished(haystack, "You only need a public wallet address to follow on-chain activity never a seed phrase or private key"), false);
  assert.equal(textLooksPublished(haystack, "completely unrelated airdrop giveaway seed phrase"), false);
});

test("matches ETH support reply even when punctuation differs", () => {
  const reply = "Yes—Ethereum is surfaced as available in the current product. You can track public ETH addresses for activity, history, and alerts. Confirm in the live app for your setup.";
  const profileHaystack = `@wallettrackerH posted: Yes Ethereum is surfaced as available in the current product. You can track public ETH addresses for activity history and alerts.`;
  assert.equal(textLooksPublished(profileHaystack, reply), true);
});
