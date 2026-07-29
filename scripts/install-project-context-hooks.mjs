import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dashboardDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDir = resolve(dashboardDir, "..");
const hooksDir = join(dashboardDir, "hooks");
const repositories = [
  "wallet-tracker-backend",
  "new-wallet-tracker",
  "wallet-stats",
  "authentication-and-authorization",
  "notification",
  "social-agent-dashboard",
];

for (const repository of repositories) {
  const repoDir = join(workspaceDir, repository);
  if (!existsSync(join(repoDir, ".git"))) continue;
  execFileSync("git", ["-C", repoDir, "config", "core.hooksPath", hooksDir], { stdio: "inherit" });
  console.log(`Installed shared project-context hooks for ${repository}`);
}
