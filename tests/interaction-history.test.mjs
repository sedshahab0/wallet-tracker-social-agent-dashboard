import assert from "node:assert/strict";
import test from "node:test";
import {
  commentFingerprint,
  historySummaryForPrompt,
  isSimilarRecentComment,
  normalizePostUrl,
  wasAccountRecentlyEngaged,
  wasPostRecentlyEngaged,
} from "../lib/interaction-history.ts";

const sample = [
  {
    id: "2026-07-29-int-1",
    interactionId: "int-1",
    account: "@WhaleAlert",
    postUrl: "https://x.com/WhaleAlert/status/111",
    comment: "Public address tracking helps separate noise from meaningful flow.",
    commentFingerprint: commentFingerprint("Public address tracking helps separate noise from meaningful flow."),
    reachScore: 88,
    verified: true,
    matchedUrl: "https://x.com/WhaleAlert/status/111",
    date: "2026-07-29",
    completedAt: new Date().toISOString(),
  },
];

test("detects recently engaged posts and accounts", () => {
  assert.equal(wasPostRecentlyEngaged("https://x.com/WhaleAlert/status/111", sample), true);
  assert.equal(wasPostRecentlyEngaged("https://x.com/WhaleAlert/status/222", sample), false);
  assert.equal(wasAccountRecentlyEngaged("@WhaleAlert", sample), true);
  assert.equal(normalizePostUrl("https://x.com/a/status/1/"), "https://x.com/a/status/1");
});

test("flags similar recent comments", () => {
  assert.equal(
    isSimilarRecentComment("Public address tracking helps separate noise from meaningful on-chain flow.", sample),
    true,
  );
  assert.equal(isSimilarRecentComment("Totally unrelated lunch plans in the city center.", sample), false);
});

test("builds learning summary for next daily plan", () => {
  const summary = historySummaryForPrompt(sample);
  assert.match(summary, /WhaleAlert/);
  assert.match(summary, /verified=yes/);
  assert.match(summary, /Do not target these post URLs again/);
});
