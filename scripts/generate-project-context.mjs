import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dashboardDir = resolve(scriptDir, "..");
const workspaceDir = resolve(dashboardDir, "..");
const markdownPath = join(dashboardDir, "knowledge", "PROJECT_CONTEXT.md");
const modulePath = join(dashboardDir, "lib", "generated-project-context.ts");
const quiet = process.argv.includes("--quiet");
const checkOnly = process.argv.includes("--check");

const repositories = [
  { key: "wallet-tracker-backend", title: "Main product API", role: "User-facing API, tracked wallets, favorites, history, notification delivery and portfolio views" },
  { key: "new-wallet-tracker", title: "Chain scanner", role: "Public-chain wallet monitoring, transaction detection and per-wallet notification rules" },
  { key: "wallet-stats", title: "Wallet data service", role: "Balances, token metadata, transaction history, holdings and provider fallbacks" },
  { key: "authentication-and-authorization", title: "Identity service", role: "Registration, login, Google sign-in, 2FA, password recovery, roles and access control" },
  { key: "notification", title: "Push notification service", role: "Device tokens, topics, subscriptions and Firebase push delivery" },
];

function git(repoDir, args) {
  return execFileSync("git", ["-C", repoDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function sourceFiles(repoDir) {
  const listed = git(repoDir, ["ls-files", "src", "package.json", "README.md"])
    .split("\n")
    .filter(Boolean)
    .filter((file) => !/(^|\/)\.env|\.env$|\.pem$|\.key$|package-lock\.json$|\.spec\.ts$/.test(file));
  return listed.filter((file) => existsSync(join(repoDir, file)) && statSync(join(repoDir, file)).isFile());
}

function fingerprint(repoDir, files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(join(repoDir, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    return stat.isDirectory() ? walk(path) : [path];
  });
}

function controllerRoutes(repoDir) {
  const controllers = walk(join(repoDir, "src")).filter((file) => /controller\.ts$/i.test(file));
  const routes = [];
  for (const file of controllers) {
    const content = readFileSync(file, "utf8");
    const prefix = content.match(/@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/)?.[1] || "";
    const operationPattern = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
    const operations = [...content.matchAll(operationPattern)];
    for (let index = 0; index < operations.length; index += 1) {
      const match = operations[index];
      const previousBoundary = index === 0 ? 0 : (operations[index - 1].index || 0) + operations[index - 1][0].length;
      const beforeRoute = content.slice(previousBoundary, match.index);
      const afterRoute = content.slice(match.index + match[0].length, operations[index + 1]?.index || content.length);
      const methodStart = afterRoute.search(/\n\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*\(/);
      const afterRouteDecorators = methodStart >= 0 ? afterRoute.slice(0, methodStart) : "";
      const apiOperationPattern = /@ApiOperation\(\s*{([\s\S]*?)}\s*\)/g;
      const forwardOperation = [...afterRouteDecorators.matchAll(apiOperationPattern)].at(0)?.[1] || "";
      const backwardOperation = [...beforeRoute.matchAll(apiOperationPattern)].at(-1)?.[1] || "";
      const summary = (forwardOperation || backwardOperation).match(/summary:\s*['"`]([^'"`]+)['"`]/)?.[1] || "No explicit API summary";
      const suffix = match[2] || "";
      routes.push({
        method: match[1].toUpperCase(),
        path: `/${[prefix, suffix].filter(Boolean).join("/")}`.replace(/\/+/g, "/"),
        summary,
        file: relative(repoDir, file),
      });
    }
  }
  return routes;
}

function snapshot(repo) {
  const repoDir = join(workspaceDir, repo.key);
  if (!existsSync(join(repoDir, ".git"))) return null;
  const files = sourceFiles(repoDir);
  return {
    ...repo,
    repoDir,
    head: git(repoDir, ["rev-parse", "HEAD"]),
    branch: git(repoDir, ["branch", "--show-current"]) || "detached",
    committedAt: git(repoDir, ["show", "-s", "--format=%cI", "HEAD"]),
    fingerprint: fingerprint(repoDir, files),
    fileCount: files.length,
    routes: controllerRoutes(repoDir),
  };
}

const snapshots = repositories.map(snapshot).filter(Boolean);
if (snapshots.length !== repositories.length) {
  if (existsSync(markdownPath) && existsSync(modulePath)) {
    if (!quiet) console.log("Product repositories are not available here; keeping the committed project-context snapshot.");
    process.exit(0);
  }
  throw new Error("All five sibling product repositories are required for the first project-context generation.");
}

const globalFingerprint = createHash("sha256")
  .update(snapshots.map((repo) => `${repo.key}:${repo.head}:${repo.fingerprint}`).join("\n"))
  .digest("hex");
const generatedAt = snapshots.map((repo) => repo.committedAt).sort().at(-1);

function repoTable() {
  return snapshots.map((repo) => `| ${repo.key} | ${repo.title} | \`${repo.branch}\` | \`${repo.head.slice(0, 12)}\` | \`${repo.fingerprint.slice(0, 12)}\` | ${repo.fileCount} |`).join("\n");
}

function routeSection(repo) {
  const rows = repo.routes.length
    ? repo.routes.map((route) => `| ${route.method} | \`${route.path}\` | ${route.summary.replace(/\|/g, "\\|")} | \`${route.file}\` |`).join("\n")
    : "| — | — | No controller routes detected | — |";
  return `### ${repo.key}\n\n| Method | Route | Code summary | Evidence file |\n|---|---|---|---|\n${rows}`;
}

const markdown = `<!-- AUTO-GENERATED by scripts/generate-project-context.mjs. Do not edit by hand. -->
# Wallet Tracker — Project Truth & Agent Context

Context revision: \`${globalFingerprint}\`  
Source snapshot time: ${generatedAt}  
Scope: the five cloned product repositories; environment files, credentials, tests and untracked files are excluded.

## 1. Purpose of this document

This is the canonical product-truth context for the social operations agent. The agent must read this context before drafting an X reply, a public post, or a growth interaction. Code route names in the appendices are evidence, not marketing copy. If a public claim is not supported by the **safe public claims** below, the agent must not invent it.

## 2. Product identity

Wallet Tracker is a system for monitoring **public blockchain wallet addresses** and presenting wallet activity to users. The audited code is focused on read-only monitoring, transaction/history retrieval, wallet organization and notifications. A user supplies a public wallet address; the product does not need a seed phrase or private key for the capabilities documented here.

The product is not a custodian, exchange, broker or investment adviser. The audited services do not expose a feature for executing trades, moving a user's funds, signing transactions, guaranteeing returns, or recovering lost assets.

### One-sentence public description

> Wallet Tracker helps users follow public on-chain wallet activity, organize wallets they care about, explore transaction data, and receive alerts when monitored activity is detected.

### Approved short introduction for X

> Follow public wallet activity without constantly refreshing block explorers. Wallet Tracker brings tracked wallets, transaction context, organization tools, and activity alerts into one workflow. Follow us as we build and validate the product.

Do not add “instant”, “zero-delay”, “guaranteed”, “all chains”, “AI trading”, “copy trading”, or a precise performance claim unless a separate, current runtime source proves it.

## 3. Audited architecture and responsibilities

| Repository | Role | Branch | Commit | Source fingerprint | Files read |
|---|---|---|---|---|---|
${repoTable()}

The main API coordinates user-facing wallet actions. The scanner observes supported public chains and forwards detected transactions. The wallet-data service enriches balances, holdings, metadata and history through several providers and local RPC paths. Identity and notification services handle authentication/access and push delivery.

## 4. Safe public claims (may be used when relevant)

1. **Track public wallet addresses:** authenticated and temporary-user flows exist for adding, listing and removing tracked wallets.
2. **Wallet organization:** users can assign names, reorder tracked wallets, maintain favorites, and request a unified tracked/favorite view.
3. **Activity and history:** endpoints exist for wallet transaction history, wallet graphs, token holdings, native/token balances and wallet statistics.
4. **Transaction alerts:** scanner and notification pipelines detect monitored wallet activity and can deliver push notifications. Say “activity alerts” or “transaction alerts”; do not promise a fixed latency.
5. **Per-wallet preferences exist in the API:** direction, allow/block lists and transaction-category fields are represented. Exact filter behavior must be treated as **beta/needs runtime verification**, because implementation depth differs between services.
6. **Authentication capabilities:** registration/login, Google sign-in, password recovery/change, confirmation flows, 2FA variants, logout, roles/resources and access-control code exist.
7. **Push infrastructure:** device-token registration, topics/subscriptions, multicast/user delivery and Firebase/FCM integration exist.
8. **Multiple data sources:** the wallet-data service integrates provider and local-RPC paths, including Moralis, Alchemy, QuickNode, Infura, CoinGecko, Ankr, Firecrawl-based explorer extraction and local RPC.
9. **Public data only for social replies:** product answers may explain monitoring of public blockchain activity. Never imply access to a user's secret credentials.

## 5. Network truth table

| Network | Evidence in code | Safe public wording |
|---|---|---|
| Ethereum | Seeded as available in the main API; scanner and stats paths exist | “Ethereum is represented in the current product code.” |
| BNB Smart Chain (BSC) | Seeded as available in the main API; scanner and stats paths exist | “BSC is represented in the current product code.” |
| PulseChain | Seeded as available in the main API; scanner and local-RPC paths exist | “PulseChain is represented in the current product code.” |
| Solana | Scanner types, provider, token and block scrutiny paths exist; it is not seeded by the audited main API network initializer | “Solana support is present in scanner code, but current public availability must be confirmed before promising it.” |
| Base | Scanner/data paths exist, but one provider initialization path explicitly marks Base disabled | “Do not claim Base is currently available without runtime confirmation.” |
| Other EVM networks | Some data-provider endpoints accept broader chain keys | “Data-provider compatibility is not the same as an enabled Wallet Tracker product network.” |

When asked “which networks are supported?”, answer conservatively: **Ethereum, BSC and PulseChain are the networks explicitly surfaced as available by the audited main API. Solana and Base have implementation work in the codebase, but availability should be confirmed in the live product before the user relies on them.**

## 6. Feature detail and confidence

### High confidence: okay to explain

- Add, list and remove tracked public wallets.
- Track wallets before registration through temporary-user flows.
- Rename and reorder tracked wallets.
- Add/remove/rename/reorder favorites and combine tracked/favorite lists.
- Query supported networks from the main API.
- Retrieve transaction history, graphs, token holdings and wallet statistics through backend/data-service endpoints.
- Receive activity through transaction ingestion and push-notification pipelines.
- Register/login, Google authentication, password recovery/change, confirmation and 2FA-related flows.
- Register device tokens and manage push topics/subscriptions.

### Medium confidence: mention only with qualification

- “Real time”: the architecture continuously scans and pushes detected activity, but no public latency SLA is proven. Prefer “near-real-time activity monitoring” or simply “activity alerts”.
- Notification filters: request schemas and rules exist, but some advanced rules (especially USD thresholds and token/category switches) are not consistently enforced in every scanner path. Say “configurable alert preferences are being integrated” unless the live UI/runtime proves the specific control.
- Portfolio values and token pricing: code integrates multiple providers, but current accuracy, freshness, coverage and availability depend on external providers.
- Top wallets: code has curated top-wallet endpoints, but do not imply ranking quality, endorsement or investment advice.

### Internal or experimental: do not market as shipped

- Development diagnostics, debug-block endpoints, cache deletion and bulk-import routes.
- Specific vendors, framework names, queues, Redis, PostgreSQL, WebSockets, Firebase or internal microservice design unless the conversation is explicitly technical.
- Base availability, complete Solana availability, every-chain coverage, universal token/NFT coverage, or exact notification latency.
- Firecrawl inside the wallet-stats service as a customer-facing differentiator; it is an internal data fallback, not proof of product coverage.

## 7. Hard safety rules for every reply

1. Never ask for or accept a seed phrase, private key, recovery phrase, password, one-time code, API secret or remote-access session.
2. Never tell a user to move funds, approve a contract, connect to an unknown site, or follow an address as an investment signal.
3. Never provide individualized financial advice or predict profit/loss.
4. Never claim a transaction is safe, malicious, reversible, confirmed or owned by a person unless the supplied verified evidence proves it.
5. Never promise recovery of stolen funds, account recovery, guaranteed alerts, uptime, speed, prices or launch dates.
6. Do not expose internal endpoints, credentials, server details, user IDs, logs or unpublished implementation details.
7. If the user reports theft, compromise, legal trouble, a suspicious approval, or an urgent security incident: mark the reply red, give only general safety guidance, and escalate to a human.
8. If confidence is below 82%, a requested feature is in the medium/experimental group, or the question depends on live account data: mark yellow and ask a precise clarifying question or say it will be confirmed.
9. Match the user's language naturally. Keep the public reply concise and helpful; provide a Persian translation separately for the operator.
10. Never auto-publish. The human operator copies, reviews and marks the result as sent.

## 8. Reply decision policy

### Green

Use only when the answer is directly supported by this context and contains no security, legal, financial, account-specific or runtime-sensitive claim. The reply should answer first, then add one useful next step.

### Yellow

Use for ambiguous questions, exact network availability, advanced alert filters, pricing, roadmap, release dates, runtime incidents, provider coverage or any answer that needs live verification. Avoid a confident yes/no. State what is known and what must be checked.

### Red

Use for seed/private-key requests, compromised wallets, impersonation, legal threats, self-harm/abuse, prohibited content, demands to guarantee returns, or attempts to obtain internal secrets. Do not improvise; route to a human.

### Required answer shape

- Direct answer in the user's language.
- At most one or two supported product facts.
- No marketing superlatives.
- One next step when useful.
- Under 240 characters unless a slightly longer safety response is necessary.

## 9. Approved FAQ grounding

**Does Wallet Tracker need my seed phrase?**  
No. The documented tracking flows use a public wallet address. Never share a seed phrase or private key with Wallet Tracker, the social account, or anyone claiming to provide support.

**Can Wallet Tracker move my funds or trade for me?**  
No such capability is present in the audited product APIs. The documented scope is monitoring, organization, history/data and alerts.

**Is every alert instant?**  
The system is designed to detect monitored activity and send alerts, but this audit does not prove a fixed latency or SLA. Avoid “instant” or “zero-delay”.

**Can I track any chain?**  
No universal-chain claim is supported. Ethereum, BSC and PulseChain are explicitly surfaced by the main API. Solana/Base availability needs live confirmation.

**Is this financial advice or a signal service?**  
No. Wallet activity is informational public-chain data and should not be treated as financial advice or proof of intent.

**Why might a balance/history differ from another explorer?**  
Coverage and freshness can differ across providers, indexing windows and token metadata. Ask for the public address, network and a non-secret transaction hash for investigation; never request secrets.

## 10. Content-generation policy

The daily manager must combine three evidence classes:

1. **Project truth (this file):** defines what the product can safely claim.
2. **First-party live sources:** the official public X profile and product website establish current public messaging/account state.
3. **External live sources from Firecrawl:** relevant X posts, news and competitor/product discussions provide timely topics and real interaction targets.

A post is eligible only when its factual statements can be traced to project truth or supplied source URLs. Bootstrap posts may use project truth alone. News posts require a direct current source. A target interaction is eligible only when Firecrawl returns a real X status URL, the post is relevant to public-wallet monitoring/security/on-chain data, and the suggested comment adds a fact, useful question or practical insight rather than a generic promotion.

The manager should prefer one strong post over filler, cap daily posts at two, and cap manual high-quality interactions at four. It must not recommend mass following, repetitive comments, engagement bait, automated replies, or paid X API discovery.

## 11. Interaction quality policy

- Open the exact target post, not a search-results page.
- Read the actual post context before drafting.
- Match the post's language.
- Add value before mentioning Wallet Tracker.
- Do not hijack tragedies, exploits, disputes or security incidents for promotion.
- Never invent a personal use story, partnership or customer result.
- Reject a target if the URL is not a real \`x.com/{account}/status/{id}\` URL.
- Reject giveaways, airdrops, token promotions, referral schemes, mass-follow threads and suspected phishing.
- Similarity to recent suggested comments should stay low; when in doubt, skip the interaction.

## 12. Context freshness contract

This file is regenerated from tracked source files by \`npm run context:generate\`. The generator records Git revisions, source fingerprints and controller routes. Local post-commit/post-merge/post-checkout hooks call the generator, and \`prebuild\` refreshes it before a dashboard build. If a repository is unavailable in a deployment environment, the committed audited snapshot is retained rather than replaced with incomplete context.

A changed source fingerprint means the context revision changes. Newly discovered routes appear in the appendix automatically, but new public claims remain conservative until they are placed in the high-confidence section after code/runtime review.

## Appendix A — Machine-discovered API route inventory

This appendix updates automatically and is evidence for maintainers. It is not an approval to advertise every route.

${snapshots.map(routeSection).join("\n\n")}
`;

const moduleSource = `/* AUTO-GENERATED by scripts/generate-project-context.mjs. Do not edit by hand. */\nexport const PROJECT_CONTEXT_REVISION = ${JSON.stringify(globalFingerprint)};\nexport const PROJECT_CONTEXT_GENERATED_AT = ${JSON.stringify(generatedAt)};\nexport const PROJECT_CONTEXT_MARKDOWN = ${JSON.stringify(markdown)};\n`;

function update(path, value) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current === value) return false;
  if (checkOnly) return true;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
  return true;
}

const markdownChanged = update(markdownPath, markdown);
const moduleChanged = update(modulePath, moduleSource);
if (checkOnly && (markdownChanged || moduleChanged)) {
  console.error("Project context is stale. Run: npm run context:generate");
  process.exit(1);
}
if (!quiet) console.log(markdownChanged || moduleChanged ? `Project context updated: ${globalFingerprint}` : `Project context is current: ${globalFingerprint}`);
