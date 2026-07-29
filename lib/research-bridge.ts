import { PROJECT_CONTEXT_MARKDOWN, PROJECT_CONTEXT_REVISION } from "@/lib/project-knowledge";
import { xaiChatCompletion } from "@/lib/xai";

export type ResearchBridgeAction = {
  topic: string;
  postCopy: string;
  postSummaryFa: string;
  interactions: Array<{ account: string; postUrl: string; comment: string; reasonFa: string }>;
  sourceUrls: string[];
  score: number;
  createdAt: string;
};

let cachedResearchBridge: ResearchBridgeAction | null = null;

function statePath() {
  return process.env.RESEARCH_BRIDGE_STATE_PATH?.trim() || ".wrangler/social-manager/research-bridge.json";
}

export async function readResearchBridge(): Promise<ResearchBridgeAction | null> {
  if (cachedResearchBridge) return cachedResearchBridge;
  try {
    const { readFile } = await import("node:fs/promises");
    cachedResearchBridge = JSON.parse(await readFile(statePath(), "utf8")) as ResearchBridgeAction;
    return cachedResearchBridge;
  } catch {
    return null;
  }
}

export async function writeResearchBridge(action: ResearchBridgeAction) {
  cachedResearchBridge = action;
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(statePath()), { recursive: true });
    await writeFile(statePath(), JSON.stringify(action), "utf8");
  } catch {
    // ignore
  }
}

const bridgeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["postCopy", "postSummaryFa", "interactions"],
  properties: {
    postCopy: { type: "string", maxLength: 260 },
    postSummaryFa: { type: "string" },
    interactions: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["account", "postUrl", "comment", "reasonFa"],
        properties: {
          account: { type: "string" },
          postUrl: { type: "string" },
          comment: { type: "string", maxLength: 240 },
          reasonFa: { type: "string" },
        },
      },
    },
  },
} as const;

export async function generateResearchBridgeActions(input: {
  topic: string;
  score: number;
  sources: Array<{ title: string; url: string; description: string }>;
}) {
  if (input.score < 80 || input.sources.length < 3) return null;

  const raw = await xaiChatCompletion({
    system: `You convert fresh research into one publishable X post and up to two high-quality interaction targets for Wallet Tracker. PROJECT TRUTH REVISION ${PROJECT_CONTEXT_REVISION} is binding. Never invent capabilities. Post copy must be <= 240 chars. Interaction postUrl must come from supplied sources when possible; otherwise use empty string and set account from source author if visible. Persian summary for operator required.\n\n${PROJECT_CONTEXT_MARKDOWN}`,
    user: JSON.stringify({
      topic: input.topic,
      researchScore: input.score,
      sources: input.sources.slice(0, 6),
    }),
    schemaName: "wallet_tracker_research_bridge",
    schema: bridgeSchema,
    timeoutMs: 75_000,
  });

  const parsed = JSON.parse(raw) as {
    postCopy: string;
    postSummaryFa: string;
    interactions: Array<{ account: string; postUrl: string; comment: string; reasonFa: string }>;
  };

  const action: ResearchBridgeAction = {
    topic: input.topic,
    postCopy: parsed.postCopy.trim(),
    postSummaryFa: parsed.postSummaryFa.trim(),
    interactions: parsed.interactions
      .filter((item) => item.comment.trim().length >= 12)
      .slice(0, 2)
      .map((item) => ({
        account: item.account.startsWith("@") ? item.account : `@${item.account.replace(/^@/, "")}`,
        postUrl: item.postUrl.trim(),
        comment: item.comment.trim(),
        reasonFa: item.reasonFa.trim(),
      })),
    sourceUrls: input.sources.map((source) => source.url).slice(0, 6),
    score: input.score,
    createdAt: new Date().toISOString(),
  };

  if (!action.postCopy) return null;
  await writeResearchBridge(action);
  return action;
}

export function researchBridgeForPrompt(action: ResearchBridgeAction | null) {
  if (!action) return "No pending research bridge actions.";
  return [
    `Latest research bridge (${action.score}/100): ${action.topic}`,
    `Suggested post: ${action.postCopy}`,
    ...action.interactions.map((item, index) => `${index + 1}. ${item.account} · ${item.postUrl || "no url"} · ${item.comment.slice(0, 90)}`),
  ].join("\n");
}
