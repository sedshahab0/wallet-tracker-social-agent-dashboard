# Wallet Tracker — Social Agent Dashboard

A human-in-the-loop AI operations dashboard for the [Wallet Tracker](https://wallettracker.app) X (Twitter) account. It polls the account's mentions, drafts grounded replies with an LLM, plans daily posts from live sources, and hands every decision to a human operator. Nothing is published without approval.

## What it does

- **Owned-mentions poller.** Runs every 2 minutes with a systemd timer. Reads new mentions using `since_id`, is idempotent on the post ID, keeps paid X API payloads minimal, and only advances the cursor after a successful write.
- **Grounded reply drafting.** The LLM (xAI Grok) drafts replies from a generated project-knowledge file, so answers stay tied to what the product actually does.
- **Deterministic safety layer** ([`lib/reply-policy.ts`](lib/reply-policy.ts)). It runs *after* the model and can only raise risk, never lower it:
  - 🔴 **red**: seed phrases, private keys, hacked or drained wallets, or a draft asking the user for secrets. Always goes to a human.
  - 🟡 **yellow**: live-sensitive topics (pricing, roadmap, supported chains, latency) or absolute claims such as "guaranteed" or "zero delay".
  - 🟢 **green**: grounded in at least one supporting fact.
  - It understands both English and Persian.
- **Daily growth plan.** Collects live sources (Firecrawl, off by default to protect credits), builds a daily content plan, and sends it to the operator on Telegram.
- **Publish verification.** After an operator posts, the dashboard checks X to confirm the post really exists before marking it published.
- **Operator dashboard.** Login-protected Next.js UI with a mention inbox, reply suggestions with risk badges, a daily plan, full-screen image previews, and usage and cost tracking.

## Stack

- Next.js on [vinext](https://github.com/cloudflare/vinext), React, TypeScript
- Drizzle ORM
- X API v2, xAI, Firecrawl, Telegram Bot API
- Deployed with Nginx and systemd services and timers (see [`deploy/`](deploy/))
- Tests use Node's built-in test runner

## Run locally

```bash
cp .env.example .env   # fill in your own credentials
npm install
npm run dev
```

```bash
npm test               # build + reply-policy, thread and rendering tests
```

Every credential comes from the environment. [`.env.example`](.env.example) lists them all, and no real key is tracked in this repository.

## Project knowledge

`npm run context:generate` rebuilds [`knowledge/PROJECT_CONTEXT.md`](knowledge/PROJECT_CONTEXT.md) from the product's services. Git hooks (`npm run context:install-hooks`) keep it current, so the agent's answers change when the product changes.

## Author

Built by **Seyed Shahaboddin Hosseini**, a backend and DevOps engineer.
