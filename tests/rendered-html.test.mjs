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
  assert.match(page, /@WalletTrackerHQ/);
  assert.match(page, /https:\/\/x\.com\/WalletTrackerHQ/);
  assert.match(page, /wallet-social-sent-posts/);
  assert.match(page, /wallet-social-sent-replies/);
  assert.match(page, /wallet-social-content-items/);
  assert.match(page, /wallet-social-reply-items/);
  assert.match(page, /wallet-social-settings/);
  assert.match(page, /reply-editor-form/);
  assert.match(page, /content-editor-form/);
  assert.match(page, /research-request-form/);
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
  assert.match(layout, /lang="fa" dir="rtl"/);
  assert.doesNotMatch(page, /fc-[a-zA-Z0-9_-]+/);
});

test("keeps Telegram credentials server-side", async () => {
  const route = await readFile(new URL("../app/api/telegram/route.ts", import.meta.url), "utf8");
  assert.match(route, /process\.env\.TELEGRAM_BOT_TOKEN/);
  assert.match(route, /sendMessage/);
  assert.doesNotMatch(route, /8856131466:/);
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
