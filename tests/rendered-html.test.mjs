import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the secure Persian login", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="fa" dir="rtl">/i);
  assert.match(html, /<title>ورود امن \| Wallet Tracker<\/title>/i);
  assert.match(html, /خوش آمدید/);
  assert.match(html, /ورود به داشبورد/);
  assert.match(html, /wallet-tracker-x-avatar-400/);
  assert.match(html, /wallet-tracker-browser-icon/);
  assert.doesNotMatch(html, /سشن رمزنگاری‌شده/);
  assert.match(html, /<form[^>]+novalidate/i);
});

test("lets the branded application login handle production authentication", async () => {
  const nginx = await readFile(new URL("../deploy/nginx-agent.wallettracker.app.conf", import.meta.url), "utf8");
  assert.doesNotMatch(nginx, /auth_basic\s+"/);
  assert.doesNotMatch(nginx, /auth_basic_user_file/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3002/);
});

test("protects dashboard routes and preserves the requested destination", async () => {
  const rootResponse = await render();
  assert.equal(rootResponse.status, 307);
  assert.match(rootResponse.headers.get("location") ?? "", /\/login$/);

  const contentResponse = await render("/content");
  assert.equal(contentResponse.status, 307);
  assert.match(contentResponse.headers.get("location") ?? "", /\/login\?next=%2Fcontent$/);
});

test("keeps the human publishing and Telegram workflows in the dashboard", async () => {
  const [page, css, layout] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /من این پست را منتشر کردم/);
  assert.match(page, /من این پاسخ را ارسال کردم/);
  assert.match(page, /اعلان‌های تلگرام/);
  assert.match(page, /\/api\/telegram/);
  assert.match(page, /SocialWalletTrackerBot/);
  assert.match(page, /@wallettrackerH/);
  assert.match(page, /https:\/\/x\.com\/wallettrackerH/);
  assert.doesNotMatch(page, /@WalletTrackerHQ/);
  assert.match(page, /wallet-social-sent-posts/);
  assert.match(page, /wallet-social-sent-replies/);
  assert.match(page, /wallet-social-content-items/);
  assert.match(page, /wallet-social-reply-items/);
  assert.match(page, /reply-editor-form/);
  assert.match(page, /content-editor-form/);
  assert.match(page, /research-request-form/);
  assert.match(page, /\/api\/research/);
  assert.match(page, /\/api\/x/);
  assert.match(page, /بررسی تنظیمات/);
  assert.match(page, /پژوهش زنده در حال اجراست/);
  assert.match(page, /اعلان تلگرام ارسال شد/);
  assert.match(page, /role="status" aria-live="polite"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /transitionPhase/);
  assert.match(page, /content-stage/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /\.mobile-bottom-nav/);
  assert.match(css, /@keyframes view-reveal/);
  assert.match(css, /@keyframes skeleton-enter/);
  assert.match(css, /@keyframes conversation-swap/);
  assert.match(css, /@keyframes modal-card-in/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /\.panel:hover[\s\S]*translate3d\(0,-7px,0\)/);
  assert.match(css, /surface-in 520ms var\(--ease-soft\) backwards/);
  assert.match(css, /card-deal 500ms var\(--ease-soft\) backwards/);
  assert.match(css, /\.modal-backdrop/);
  assert.match(css, /\.action-menu/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /overflow-x: hidden/);
  assert.match(css, /\.sidebar::\-webkit-scrollbar-thumb/);
  assert.match(css, /scrollbar-color: rgba\(255,116,23,\.62\) transparent/);
  assert.match(layout, /lang="fa" dir="rtl"/);
  assert.doesNotMatch(page, /fc-[a-zA-Z0-9_-]+/);
});

test("keeps Telegram credentials server-side", async () => {
  const route = await readFile(new URL("../app/api/telegram/route.ts", import.meta.url), "utf8");
  assert.match(route, /process\.env\.TELEGRAM_BOT_TOKEN/);
  assert.match(route, /sendMessage/);
  assert.doesNotMatch(route, /8856131466:/);
});

test("runs selective Firecrawl research server-side and announces completion", async () => {
  const [route, proxyRoute, exampleEnv] = await Promise.all([
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/firecrawl-proxy/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(route, /api\.firecrawl\.dev\/v2\/search/);
  assert.match(route, /process\.env\.FIRECRAWL_API_KEY/);
  assert.match(route, /sendMessage/);
  assert.match(route, /hasDashboardSession/);
  assert.match(route, /telegramNotified/);
  assert.match(route, /FIRECRAWL_PROXY_URL/);
  assert.match(proxyRoute, /x-research-proxy-key/);
  assert.match(proxyRoute, /RESEARCH_PROXY_SECRET/);
  assert.match(exampleEnv, /FIRECRAWL_API_KEY=\n/);
  assert.doesNotMatch(`${route}\n${proxyRoute}`, /fc-[a-zA-Z0-9_-]+/);
});

test("keeps dashboard credentials server-side and signs the session", async () => {
  const [auth, loginRoute, exampleEnv] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /DASHBOARD_SESSION_SECRET/);
  assert.match(auth, /HMAC/);
  assert.match(auth, /safeDashboardPath/);
  assert.match(loginRoute, /httpOnly: true/);
  assert.match(loginRoute, /sameSite: "lax"/);
  assert.match(loginRoute, /MAX_ATTEMPTS = 5/);
  assert.match(exampleEnv, /DASHBOARD_PASSWORD=\n/);
  assert.doesNotMatch(`${auth}\n${loginRoute}\n${exampleEnv}`, /\+8DOYWNKDs159A5uzzsSYxu1/);
});

test("keeps X credentials server-side and exposes guarded live endpoints", async () => {
  const [statusRoute, mentionsRoute, xApi, exampleEnv] = await Promise.all([
    readFile(new URL("../app/api/x/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/x/mentions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/x-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(statusRoute, /hasDashboardSession/);
  assert.match(mentionsRoute, /hasDashboardSession/);
  assert.match(mentionsRoute, /readXInbox/);
  assert.doesNotMatch(mentionsRoute, /xGetOwned|api\.x\.com/);
  assert.match(xApi, /process\.env\.X_ACCESS_TOKEN/);
  assert.match(xApi, /The sole paid X request in this product/);
  assert.match(xApi, /api\.x\.com/);
  assert.match(exampleEnv, /X_BEARER_TOKEN=\n/);
  assert.doesNotMatch(`${statusRoute}\n${mentionsRoute}\n${xApi}`, /Bearer\s+[A-Za-z0-9%_-]{40,}/);
});

test("ships the full-service strategy, creative and growth workflows", async () => {
  const [page, auth, css] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const route of ["/strategy", "/tasks", "/creative", "/growth"]) {
    assert.match(page, new RegExp(route));
    assert.match(auth, new RegExp(route));
  }
  assert.match(page, /استراتژی و تقویم/);
  assert.match(page, /کارهای امروز/);
  assert.match(page, /استودیوی محتوا/);
  assert.match(page, /رشد و تعامل/);
  assert.match(page, /wallet-social-daily-tasks-\$\{plan\.date\}/);
  assert.match(page, /wallet-social-last-creative-brief-live-v2/);
  assert.match(page, /هیچ وظیفه آزمایشی نمایش داده نمی‌شود/);
  assert.match(page, /فرصت تعامل واقعی پیدا نشده است/);
  assert.match(page, /هنوز بسته محتوای واقعی ساخته نشده است/);
  assert.doesNotMatch(page, /@carlos_chain|@noor_web3|@chainwatcher|dailyTaskSeed|staticOpportunities|strategyDays/);
  assert.doesNotMatch(page, /رهگیری کیف‌پول‌های سولانا فعال شد|پرسش‌های امنیت کیف‌پول در حال افزایش است|پست جدید آماده انتشار است/);
  assert.match(page, /اعتبار X برای رشد مصرف نمی‌شود/);
  assert.match(page, /حداکثر ۴ تعامل دستی باکیفیت در روز/);
  assert.match(css, /\.calendar-grid/);
  assert.match(css, /\.creative-pipeline/);
  assert.match(css, /\.opportunity-card/);
  assert.match(css, /\.lift-card:hover/);
});

test("keeps the operator flow simple and reserves X credit for owned mentions", async () => {
  const [page, statusRoute, mentionsRoute, xApi] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/x/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/x/mentions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/x-api.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /مدیر هوشمند روزانه · داده زنده/);
  assert.match(page, /کارهای اپراتور · از بالا به پایین/);
  assert.match(page, /ابزارهای مدیر · اپراتور نیاز ندارد/);
  assert.match(page, /۵ دلار فقط برای خواندن کامنت‌های جدید/);
  assert.match(page, /۰٫۰۰۱ دلار/);
  assert.match(page, /هشدار اولیه در ۲٫۵۰ دلار/);
  assert.match(page, /هشدار مهم در ۴ دلار/);
  assert.match(page, /توقف در ۴٫۹۹ دلار/);
  assert.match(statusRoute, /must never spend X credits/);
  assert.doesNotMatch(statusRoute, /resolveXAccount|xGet/);
  assert.match(mentionsRoute, /xAccountId/);
  assert.match(mentionsRoute, /readXInbox/);
  assert.doesNotMatch(mentionsRoute, /xGetOwned|resolveXAccount|users\/by\/username/);
  assert.match(xApi, /X_ACCOUNT_ID/);
  assert.match(xApi, /oauth_signature_method: "HMAC-SHA1"/);
  assert.match(xApi, /X_ACCESS_TOKEN_SECRET/);
});

test("opens generated content images in an accessible lightbox", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function ImageLightbox/);
  assert.match(page, /aria-label={`بزرگ‌نمایی تصویر/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(css, /\.image-lightbox/);
  assert.match(css, /cursor:zoom-in/);
});

test("builds an evidence-bound daily manager with Firecrawl and xAI", async () => {
  const [manager, firecrawl, xai, accountState, planRoute, cronRoute, imageRoute, proxyRoute, projectKnowledge, generatedContext, page, exampleEnv, timer] = await Promise.all([
    readFile(new URL("../lib/social-manager.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/firecrawl.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/xai.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/account-state.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/manager/daily-plan/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/manager/run/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/manager/image/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/firecrawl-proxy/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/project-knowledge.ts", import.meta.url), "utf8"),
    readFile(new URL("../knowledge/PROJECT_CONTEXT.md", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../deploy/wallet-social-manager.timer", import.meta.url), "utf8"),
  ]);
  assert.match(firecrawl, /api\.firecrawl\.dev\/v2/);
  assert.match(manager, /firecrawlScrape/);
  assert.match(manager, /collectOwnAccountState|accountState/);
  assert.match(manager, /scrapeOptions/);
  assert.match(manager, /tbs: "qdr:w"/);
  assert.match(manager, /VERIFIED_PROJECT_SOURCE/);
  assert.match(manager, /site:x\.com/);
  assert.match(manager, /Promise\.allSettled/);
  assert.match(firecrawl, /FIRECRAWL_PROXY_URL/);
  assert.match(firecrawl, /x-research-proxy-key/);
  assert.doesNotMatch(manager, /xGet|resolveXAccount|api\.x\.com/);
  assert.match(accountState, /bootstrap|early|active/);
  assert.match(proxyRoute, /operation === "scrape"/);
  assert.match(proxyRoute, /scrapeOptions/);
  assert.match(projectKnowledge, /PROJECT_CONTEXT_MARKDOWN/);
  assert.match(generatedContext, /Transaction alerts/);
  assert.match(generatedContext, /Never ask for or accept a seed phrase/);
  assert.match(xai, /api\.x\.ai\/v1\/chat\/completions/);
  assert.match(xai, /grok-4\.5/);
  assert.match(xai, /reasoning_effort/);
  assert.match(xai, /medium/);
  assert.match(manager, /json_schema|xaiChatCompletion/);
  assert.match(manager, /evidenceBoundPlan/);
  assert.match(manager, /allowedUrls\.has/);
  assert.match(planRoute, /hasDashboardSession/);
  assert.match(cronRoute, /timingSafeEqual/);
  assert.match(cronRoute, /SOCIAL_MANAGER_CRON_SECRET/);
  assert.match(imageRoute, /api\.x\.ai\/v1\/images\/generations/);
  assert.match(imageRoute, /grok-imagine-image/);
  assert.match(imageRoute, /data:\$\{mimeType\};base64/);
  assert.match(page, /مدیر هوشمند روزانه · داده زنده/);
  assert.match(page, /Firecrawl در حال بررسی X|وضعیت زنده اکانت رسمی/);
  assert.match(page, /\/api\/manager\/image/);
  assert.match(page, /\/api\/x\/verify/);
  assert.match(exampleEnv, /XAI_API_KEY=\n/);
  assert.match(exampleEnv, /XAI_TEXT_MODEL=grok-4\.5/);
  assert.match(exampleEnv, /XAI_REASONING_EFFORT=medium/);
  assert.match(exampleEnv, /SOCIAL_MANAGER_CRON_SECRET=\n/);
  assert.match(timer, /06:15:00 Asia\/Tehran/);
  assert.doesNotMatch(`${manager}\n${xai}\n${imageRoute}\n${exampleEnv}`, /xai-[A-Za-z0-9_-]{20,}/);
});

test("polls owned X mentions and resolves real Twitter handles via Firecrawl", async () => {
  const [pollRoute, inboxRoute, inbox, page, timer, verifyRoute] = await Promise.all([
    readFile(new URL("../app/api/x/poll/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/x/inbox/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/x-inbox.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../deploy/wallet-x-poller.timer", import.meta.url), "utf8"),
    readFile(new URL("../app/api/x/verify/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(pollRoute, /SOCIAL_MANAGER_CRON_SECRET/);
  assert.match(pollRoute, /timingSafeEqual/);
  assert.doesNotMatch(inbox, /expansions:\s*"author_id"|"user\.fields"/);
  assert.doesNotMatch(inbox, /کاربر X · \$\{.*author_id/);
  assert.match(inboxRoute, /hasDashboardSession/);
  assert.match(inbox, /xGetOwned/);
  assert.match(inbox, /since_id/);
  assert.match(inbox, /HARD_STOP_RESOURCE_READS = 4_990/);
  assert.match(inbox, /2_500/);
  assert.match(inbox, /4_000/);
  assert.match(inbox, /notifyBudget/);
  assert.match(inbox, /xaiChatCompletion|api\.x\.ai/);
  assert.match(inbox, /extractHandle/);
  assert.match(inbox, /tweetUrl/);
  assert.match(inbox, /same language/);
  assert.match(inbox, /applyReplySafety/);
  assert.match(inbox, /sendMessage/);
  assert.match(verifyRoute, /verifyPublication/);
  assert.match(page, /\/api\/x\/inbox/);
  assert.match(page, /\/api\/x\/verify/);
  assert.match(page, /tweetUrl/);
  assert.match(page, /آیدی توییتر|dir="ltr"/);
  assert.match(page, /120_000/);
  assert.match(timer, /OnUnitActiveSec=2min/);
});
