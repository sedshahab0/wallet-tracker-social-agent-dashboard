import type { DailyManagerPlan } from "@/lib/social-manager-types";

const memory = new Map<string, DailyManagerPlan>();

function statePath() {
  return process.env.SOCIAL_MANAGER_STATE_PATH?.trim() || ".wrangler/social-manager/daily-plan.json";
}

export async function readDailyPlan(date: string) {
  if (memory.has(date)) return memory.get(date)!;
  try {
    const { readFile } = await import("node:fs/promises");
    const value = JSON.parse(await readFile(statePath(), "utf8")) as DailyManagerPlan;
    if (value.date === date) {
      memory.set(date, value);
      return value;
    }
  } catch {
    // Cloud runtimes without writable files use the in-process cache.
  }
  return null;
}

export async function writeDailyPlan(plan: DailyManagerPlan) {
  memory.set(plan.date, plan);
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(statePath()), { recursive: true });
    await writeFile(statePath(), JSON.stringify(plan), "utf8");
  } catch {
    // The memory cache remains available when the runtime is read-only.
  }
}
