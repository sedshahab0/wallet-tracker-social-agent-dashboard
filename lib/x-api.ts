type XUser = {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
};

type XEnvelope<T> = {
  data?: T;
  errors?: Array<{ title?: string; detail?: string; type?: string }>;
  title?: string;
  detail?: string;
};

let cachedAccount: { value: XUser; expiresAt: number } | null = null;

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

export function xApiIsConfigured() {
  return Boolean(process.env.X_BEARER_TOKEN?.trim() && xAccountUsername());
}

function bearerToken() {
  return process.env.X_BEARER_TOKEN?.trim() || "";
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

export async function xGet<T>(path: string) {
  if (!xApiIsConfigured()) {
    throw new XApiError("کلیدهای X API هنوز روی سرور تنظیم نشده‌اند.", 503, "invalid_credentials");
  }
  const response = await fetch(`https://api.x.com${path}`, {
    headers: { authorization: `Bearer ${bearerToken()}` },
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => ({}))) as XEnvelope<T>;
  if (!response.ok || payload.data === undefined) throw apiError(response.status, payload);
  return payload;
}

export async function resolveXAccount() {
  if (cachedAccount && cachedAccount.expiresAt > Date.now()) return cachedAccount.value;
  const username = encodeURIComponent(xAccountUsername());
  const payload = await xGet<XUser>(`/2/users/by/username/${username}?user.fields=id,name,username,profile_image_url,verified,public_metrics`);
  cachedAccount = { value: payload.data!, expiresAt: Date.now() + 5 * 60 * 1000 };
  return cachedAccount.value;
}

