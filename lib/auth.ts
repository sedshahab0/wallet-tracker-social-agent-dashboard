import { cookies } from "next/headers";

export const DASHBOARD_SESSION_COOKIE = "wallet_tracker_dashboard_session";
export const DASHBOARD_SESSION_MAX_AGE = 60 * 60 * 12;

const encoder = new TextEncoder();

function authSecret() {
  return process.env.DASHBOARD_SESSION_SECRET || "";
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function dashboardAuthIsConfigured() {
  return Boolean(
    process.env.DASHBOARD_USERNAME &&
    process.env.DASHBOARD_PASSWORD &&
    process.env.DASHBOARD_SESSION_SECRET,
  );
}

export function dashboardCredentialsAreValid(username: string, password: string) {
  const expectedUsername = process.env.DASHBOARD_USERNAME || "";
  const expectedPassword = process.env.DASHBOARD_PASSWORD || "";
  return (
    dashboardAuthIsConfigured() &&
    safeEqual(username, expectedUsername) &&
    safeEqual(password, expectedPassword)
  );
}

export async function createDashboardSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + DASHBOARD_SESSION_MAX_AGE;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyDashboardSessionToken(token?: string) {
  if (!token || !dashboardAuthIsConfigured()) return false;
  const [expiresAt, nonce, signature, ...rest] = token.split(".");
  if (!expiresAt || !nonce || !signature || rest.length > 0) return false;
  if (!/^\d+$/.test(expiresAt) || !/^[a-f0-9]{32}$/i.test(nonce)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expectedSignature = await sign(`${expiresAt}.${nonce}`);
  return safeEqual(signature, expectedSignature);
}

export async function hasDashboardSession() {
  const cookieStore = await cookies();
  return verifyDashboardSessionToken(cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value);
}

const allowedPaths = new Set([
  "/",
  "/replies",
  "/content",
  "/history",
  "/telegram",
  "/research",
  "/budget",
  "/settings",
]);

export function safeDashboardPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  let url: URL;
  try {
    url = new URL(value, "https://dashboard.local");
  } catch {
    return "/";
  }
  return allowedPaths.has(url.pathname) ? url.pathname : "/";
}
