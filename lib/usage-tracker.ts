type UsageBucket = {
  chatRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  imageGenerations: number;
};

type FirecrawlBucket = {
  searches: number;
  scrapes: number;
  failures: number;
};

export type UsageState = {
  month: string;
  xai: UsageBucket;
  firecrawl: FirecrawlBucket;
  updatedAt: string;
};

const memory: UsageState = {
  month: currentMonth(),
  xai: emptyXai(),
  firecrawl: emptyFirecrawl(),
  updatedAt: "",
};

/** Serialize all read-modify-write cycles so parallel Firecrawl/xAI calls cannot lose counters. */
let mutationQueue: Promise<unknown> = Promise.resolve();

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function emptyXai(): UsageBucket {
  return { chatRequests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, imageGenerations: 0 };
}

function emptyFirecrawl(): FirecrawlBucket {
  return { searches: 0, scrapes: 0, failures: 0 };
}

function statePath() {
  return process.env.AI_USAGE_STATE_PATH?.trim() || ".wrangler/usage/ai-usage.json";
}

function normalizeMonth(state: UsageState): UsageState {
  const month = currentMonth();
  if (state.month === month) return state;
  return { month, xai: emptyXai(), firecrawl: emptyFirecrawl(), updatedAt: state.updatedAt };
}

function mergeState(parsed: Partial<UsageState> | null | undefined): UsageState {
  return normalizeMonth({
    month: parsed?.month || memory.month || currentMonth(),
    xai: { ...emptyXai(), ...(parsed?.xai || {}) },
    firecrawl: { ...emptyFirecrawl(), ...(parsed?.firecrawl || {}) },
    updatedAt: parsed?.updatedAt || memory.updatedAt || "",
  });
}

export async function readUsageState(): Promise<UsageState> {
  try {
    const { readFile } = await import("node:fs/promises");
    const parsed = JSON.parse(await readFile(statePath(), "utf8")) as UsageState;
    const normalized = mergeState(parsed);
    Object.assign(memory, normalized);
    return { ...normalized, xai: { ...normalized.xai }, firecrawl: { ...normalized.firecrawl } };
  } catch {
    const normalized = mergeState(memory);
    Object.assign(memory, normalized);
    return { ...normalized, xai: { ...normalized.xai }, firecrawl: { ...normalized.firecrawl } };
  }
}

async function writeUsageState(state: UsageState) {
  Object.assign(memory, state);
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(statePath()), { recursive: true });
    await writeFile(statePath(), JSON.stringify(state), "utf8");
  } catch {
    // Keep in-memory counters when the runtime is read-only.
  }
}

async function mutateUsage(mutator: (state: UsageState) => void) {
  const run = mutationQueue.then(async () => {
    const state = await readUsageState();
    mutator(state);
    state.updatedAt = new Date().toISOString();
    await writeUsageState(state);
    return { ...state, xai: { ...state.xai }, firecrawl: { ...state.firecrawl } };
  });
  mutationQueue = run.then(() => undefined, () => undefined);
  return run;
}

export async function recordXaiChatUsage(usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) {
  const prompt = Math.max(0, Math.round(Number(usage.promptTokens) || 0));
  const completion = Math.max(0, Math.round(Number(usage.completionTokens) || 0));
  const reportedTotal = Math.max(0, Math.round(Number(usage.totalTokens) || 0));
  const total = Math.max(prompt + completion, reportedTotal);
  return mutateUsage((state) => {
    state.xai.chatRequests += 1;
    state.xai.promptTokens += prompt;
    state.xai.completionTokens += completion;
    state.xai.totalTokens += total;
  });
}

export async function recordXaiImageUsage() {
  return mutateUsage((state) => {
    state.xai.imageGenerations += 1;
  });
}

export async function recordFirecrawlUsage(operation: "search" | "scrape", ok = true) {
  return mutateUsage((state) => {
    if (operation === "search") state.firecrawl.searches += 1;
    else state.firecrawl.scrapes += 1;
    if (!ok) state.firecrawl.failures += 1;
  });
}

export function xaiMonthlyTokenBudget() {
  const raw = Number(process.env.XAI_MONTHLY_TOKEN_BUDGET || "500000");
  return Number.isFinite(raw) && raw > 0 ? raw : 500_000;
}

export function firecrawlMonthlyCreditBudget() {
  const raw = Number(process.env.FIRECRAWL_MONTHLY_CREDIT_BUDGET || "3000");
  return Number.isFinite(raw) && raw > 0 ? raw : 3_000;
}

/** Firecrawl bills roughly one credit per search/scrape in typical v2 usage. */
export function estimateFirecrawlCreditsUsed(state: UsageState) {
  return state.firecrawl.searches + state.firecrawl.scrapes;
}

export async function fetchFirecrawlLiveCredits() {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/team/credit-usage", {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: { remainingCredits?: number; planCredits?: number; billingPeriodStart?: string; billingPeriodEnd?: string };
    } | null;
    if (!payload?.data) return null;
    return {
      remainingCredits: payload.data.remainingCredits,
      planCredits: payload.data.planCredits,
      billingPeriodStart: payload.data.billingPeriodStart,
      billingPeriodEnd: payload.data.billingPeriodEnd,
    };
  } catch {
    return null;
  }
}

export async function getUsageSummary() {
  const state = await readUsageState();
  const firecrawlCreditsUsed = estimateFirecrawlCreditsUsed(state);
  const firecrawlBudget = firecrawlMonthlyCreditBudget();
  const xaiBudget = xaiMonthlyTokenBudget();
  const tokensRemaining = Math.max(0, xaiBudget - state.xai.totalTokens);
  const liveFirecrawl = await fetchFirecrawlLiveCredits();
  return {
    month: state.month,
    updatedAt: state.updatedAt,
    xai: {
      ...state.xai,
      tokenBudget: xaiBudget,
      tokensRemaining,
      tokenPercent: Math.min(100, Math.round((state.xai.totalTokens / xaiBudget) * 100)),
      model: process.env.XAI_TEXT_MODEL?.trim() || "grok-4.5",
      imageModel: process.env.XAI_IMAGE_MODEL?.trim() || "grok-imagine-image",
    },
    firecrawl: {
      ...state.firecrawl,
      creditsUsedEstimate: firecrawlCreditsUsed,
      creditBudget: firecrawlBudget,
      creditsRemainingEstimate: Math.max(0, firecrawlBudget - firecrawlCreditsUsed),
      creditPercent: Math.min(100, Math.round((firecrawlCreditsUsed / firecrawlBudget) * 100)),
      live: liveFirecrawl,
    },
  };
}
