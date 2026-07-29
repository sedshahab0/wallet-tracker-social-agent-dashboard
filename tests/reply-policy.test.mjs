import assert from "node:assert/strict";
import test from "node:test";
import { applyReplySafety } from "../lib/reply-policy.ts";

const green = {
  risk: "green",
  confidence: 94,
  answer: "Wallet Tracker follows public wallet activity and never needs your seed phrase.",
  groundingFacts: ["Tracking uses public wallet addresses"],
  needsHumanReview: false,
  reviewReasonFa: "",
};

test("keeps a grounded, non-sensitive product answer green", () => {
  const result = applyReplySafety("What does Wallet Tracker do?", green);
  assert.equal(result.risk, "green");
  assert.equal(result.confidence, 94);
});

test("forces live network availability questions to human review", () => {
  const result = applyReplySafety("Do you support Solana and Base?", green);
  assert.equal(result.risk, "yellow");
  assert.equal(result.needsHumanReview, true);
  assert.ok(result.confidence <= 81);
});

test("forces compromised-wallet and secret topics to red", () => {
  const result = applyReplySafety("My wallet was hacked. Can I send my seed phrase?", green);
  assert.equal(result.risk, "red");
  assert.equal(result.needsHumanReview, true);
  assert.ok(result.confidence <= 60);
});

test("rejects green unsupported absolutes and enforces 240 characters", () => {
  const result = applyReplySafety("How fast are alerts?", {
    ...green,
    answer: `We guarantee zero-delay instant alerts on all chains. ${"x".repeat(300)}`,
  });
  assert.equal(result.risk, "yellow");
  assert.ok(Array.from(result.answer).length <= 240);
});

test("a reply without grounding facts cannot remain green", () => {
  const result = applyReplySafety("What does it do?", { ...green, groundingFacts: [] });
  assert.equal(result.risk, "yellow");
  assert.equal(result.needsHumanReview, true);
});
