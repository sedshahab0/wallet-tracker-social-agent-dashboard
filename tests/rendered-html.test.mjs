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

test("server-renders the Persian dashboard and loading skeleton", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="fa" dir="rtl">/i);
  assert.match(html, /<title>والت سوشال · مرکز مدیریت شبکه اجتماعی<\/title>/i);
  assert.match(html, /والت سوشال/);
  assert.match(html, /aria-label="در حال بارگذاری"/);
  assert.match(html, /mobile-bottom-nav/);
});

test("serves dashboard sections as direct routes", async () => {
  const response = await render("/content");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /والت سوشال/);
  assert.match(html, /aria-label="در حال بارگذاری"/);
});

test("keeps the human publishing and Telegram workflows in the dashboard", async () => {
  const [page, css, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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
  assert.match(page, /transitionPhase/);
  assert.match(page, /content-stage/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /\.mobile-bottom-nav/);
  assert.match(css, /@keyframes view-reveal/);
  assert.match(css, /@keyframes skeleton-enter/);
  assert.match(css, /@keyframes conversation-swap/);
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
