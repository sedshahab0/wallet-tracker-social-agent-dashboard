# Wallet Social Agent — MVP Implementation Plan

## Product decision

The MVP is a human-in-the-loop social operations system:

- X Owned Reads polls the authenticated account's mentions every 120 seconds.
- The agent classifies, translates and drafts replies, but does not post them.
- Operators work from the dashboard and receive Telegram notifications.
- Firecrawl enriches only selected items.
- Monthly X API spend is capped at USD 10, with alerts at USD 5 and USD 8.

## Service boundaries

Create a separate NestJS service named `social-agent`. Do not place X polling or AI workflows inside the transaction tracker. The service will share PostgreSQL and Redis infrastructure but have its own database schema, credentials and deployment lifecycle.

```text
X API / GitLab / public product events
                 |
          social-agent service
      +----------+-----------+
      |          |           |
  PostgreSQL   BullMQ    Firecrawl
      |          |           |
      +----------+-----------+
                 |
       dashboard API + Telegram
```

## Phase 0 — Accounts, security and operating rules

1. Rotate the exposed Firecrawl key.
2. Create an X Developer Project and App owned by the same X account used by the dashboard.
3. Configure OAuth user context and store credentials in a secret manager or GitLab CI variables.
4. Set the X Developer Console spending limit to USD 10 as an external safety net.
5. Define the brand voice, supported facts, prohibited claims and escalation policy.

Acceptance:

- No API key is stored in a tracked env file.
- Test and production use different credentials.
- The app can read the authenticated account ID and its latest mentions.

## Phase 1 — Owned Reads poller

Implement a scheduled job every 120 seconds:

1. Acquire a Redis lock so only one poller instance runs.
2. Check the internal monthly spend guard before calling X.
3. Call `GET /2/users/{id}/mentions` using `since_id` and a conservative page size.
4. Normalize and insert new items using the X Post ID as an idempotency key.
5. Advance `since_id` only after the database transaction succeeds.
6. Queue each unseen item for classification.
7. Record returned resource count and estimated cost in the usage ledger.

Fallback rules:

- Retry 429 and transient 5xx responses with backoff and jitter.
- Never reset `since_id` automatically.
- If polling fails repeatedly, alert Telegram and keep the last safe cursor.

Acceptance:

- A new reply appears in the dashboard within four minutes.
- Duplicate polls never create duplicate inbox items.
- A restart does not lose or replay handled replies.

## Phase 2 — Reply intelligence pipeline

For every new reply:

1. Detect language and code-switching.
2. Classify intent: question, praise, product feedback, bug, complaint, spam, security, financial, partnership or press.
3. Load the original post, local conversation history and approved product knowledge.
4. Assign green, yellow or red risk.
5. Generate a reply in the user's language.
6. Generate a Persian operator translation and back-translation.
7. Attach confidence, evidence and recommended action.

Firecrawl runs only when at least one condition matches:

- Confidence is below 82%.
- The reply includes an external URL or current public claim.
- The answer depends on recent news or competitor activity.
- The user is marked as high-value or the conversation needs public profile context.
- An operator manually requests enrichment.

Red items never receive a ready-to-copy answer. They receive an escalation brief.

Acceptance:

- Language, intent, risk and sources are visible for every inbox item.
- Suggested replies match the source language.
- Security, loss-of-funds, legal and financial-advice cases are escalated.

## Phase 3 — Dashboard API and operator workflow

Connect the current dashboard prototype to these endpoints:

```text
GET    /v1/social/overview
GET    /v1/social/replies
GET    /v1/social/replies/:id
POST   /v1/social/replies/:id/regenerate
POST   /v1/social/replies/:id/enrich
POST   /v1/social/replies/:id/mark-posted
POST   /v1/social/replies/:id/escalate
GET    /v1/social/content
POST   /v1/social/content/:id/approve
GET    /v1/social/usage
PUT    /v1/social/settings
```

Operator actions:

- Copy reply
- Open the exact X conversation
- Mark posted
- Edit
- Regenerate
- Request Firecrawl context
- Ignore spam
- Escalate

Acceptance:

- Every action is audit logged with operator, time and before/after content.
- Two operators cannot accidentally handle the same reply.
- Posted, ignored and escalated items leave the active queue.

## Phase 4 — Telegram integration

The dashboard remains the source of truth. Telegram sends concise notifications with deep links to dashboard records.

Notifications:

- Priority reply waiting
- Red-risk escalation
- Poller unhealthy
- USD 5 budget warning
- USD 8 critical warning
- USD 10 hard stop

Do not place full credentials, private user data or destructive actions in Telegram messages.

Acceptance:

- Alerts are delivered once per threshold per billing cycle.
- Telegram links open the correct dashboard item.

## Phase 5 — Cost guardrails

Maintain an internal monthly ledger in addition to the X Developer Console limit.

| Level | Amount | Action |
|---|---:|---|
| Normal | Under USD 5 | Poll every two minutes; selective Firecrawl enabled |
| Warning | USD 5 | Dashboard and Telegram alert |
| Critical | USD 8 | Disable automatic Firecrawl enrichment; require operator request |
| Hard stop | USD 10 | Stop billable X reads; alert admins; preserve dashboard access |

The usage job reconciles estimated local cost with the X Usage API daily. Threshold notifications use idempotency keys so restarts do not resend them.

Acceptance:

- Estimated usage is visible by X, AI and Firecrawl.
- The system cannot intentionally exceed the configured internal limit.
- Changing the budget requires an admin role and is audit logged.

## Minimum database model

- `social_accounts`
- `poll_cursors`
- `inbound_replies`
- `conversation_contexts`
- `reply_drafts`
- `content_drafts`
- `operator_actions`
- `usage_ledger`
- `budget_alerts`
- `firecrawl_runs`
- `audit_logs`
- `social_settings`

## Recommended delivery order

1. Credentials and security rules
2. Poller, cursor and usage ledger
3. Basic inbox with raw replies
4. Language, intent and risk classification
5. Suggested replies and Persian translations
6. Selective Firecrawl enrichment
7. Telegram notifications
8. Content planning and publishing recommendations

The first production milestone is complete when a real X reply moves from X to the dashboard, receives a same-language suggestion, is copied by an operator and is marked handled without duplication.
