type XEnvelope<T> = {
  data?: T;
  errors?: Array<{ title?: string; detail?: string; type?: string }>;
  title?: string;
  detail?: string;
};

export class XApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: "credits_required" | "invalid_credentials" | "rate_limited" | "x_api_error",
  ) {
    super(message);
    this.name = "XApiError";
  }
}

export function xAccountUsername() {
  return process.env.X_ACCOUNT_USERNAME?.trim().replace(/^@/, "") || "wallettrackerH";
}

export function xAccountId() {
  return process.env.X_ACCOUNT_ID?.trim() || "";
}

export function xOwnedPollingIsConfigured() {
  return Boolean(
    process.env.X_API_KEY?.trim() &&
      process.env.X_API_SECRET?.trim() &&
      process.env.X_ACCESS_TOKEN?.trim() &&
      process.env.X_ACCESS_TOKEN_SECRET?.trim() &&
      xAccountId(),
  );
}

function apiError(status: number, payload: XEnvelope<unknown>) {
  const raw = [payload.title, payload.detail, ...(payload.errors || []).flatMap((error) => [error.title, error.detail])]
    .filter(Boolean)
    .join(" ");
  if (status === 402 || /credit|payment|balance|fund/i.test(raw)) {
    return new XApiError("موجودی X API صفر است؛ برای آزمایش زنده باید اعتبار حساب توسعه‌دهنده شارژ شود.", 402, "credits_required");
  }
  if (status === 401 || status === 403) {
    return new XApiError("کلید X API معتبر نیست یا دسترسی لازم برای این درخواست فعال نشده است.", status, "invalid_credentials");
  }
  if (status === 429) {
    return new XApiError("محدودیت موقت X API فعال شده است؛ چند دقیقه دیگر دوباره امتحان کنید.", 429, "rate_limited");
  }
  return new XApiError("X API پاسخ معتبری نداد؛ وضعیت App و دسترسی‌ها را در Developer Console بررسی کنید.", status || 502, "x_api_error");
}

function oauthEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function oauth1Authorization(url: URL) {
  const consumerKey = process.env.X_API_KEY!.trim();
  const consumerSecret = process.env.X_API_SECRET!.trim();
  const accessToken = process.env.X_ACCESS_TOKEN!.trim();
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET!.trim();
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replaceAll("-", ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  const signatureParams = [...url.searchParams.entries(), ...Object.entries(oauthParams)]
    .map(([key, value]) => [oauthEncode(key), oauthEncode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const normalizedUrl = `${url.protocol}//${url.host}${url.pathname}`;
  const signatureBase = `GET&${oauthEncode(normalizedUrl)}&${oauthEncode(signatureParams)}`;
  const signingKey = `${oauthEncode(consumerSecret)}&${oauthEncode(accessTokenSecret)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signatureBase));
  const oauthSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const headerParams = { ...oauthParams, oauth_signature: oauthSignature };
  return `OAuth ${Object.entries(headerParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${oauthEncode(key)}="${oauthEncode(value)}"`)
    .join(", ")}`;
}

/**
 * The sole paid X request in this product. It deliberately uses OAuth 1.0a
 * user context so the authenticated user is the owner of the developer app.
 */
export async function xGetOwned<T>(path: string) {
  if (!xOwnedPollingIsConfigured()) {
    throw new XApiError("اتصال کاربری X برای Owned Reads کامل نشده است؛ هیچ اعتباری مصرف نشد.", 503, "invalid_credentials");
  }
  const url = new URL(path, "https://api.x.com");
  const response = await fetch(url, {
    headers: { authorization: await oauth1Authorization(url) },
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => ({}))) as XEnvelope<T> & Record<string, unknown>;
  if (!response.ok) throw apiError(response.status, payload);
  return payload;
}
