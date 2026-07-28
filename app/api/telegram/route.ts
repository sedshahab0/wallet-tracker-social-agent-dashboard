type TelegramUser = {
  first_name: string;
  username?: string;
};

type TelegramChat = {
  id: number;
  title?: string;
  type: "private" | "group" | "supergroup" | "channel";
};

type TelegramUpdate = {
  update_id: number;
  message?: { chat: TelegramChat };
  edited_message?: { chat: TelegramChat };
  my_chat_member?: { chat: TelegramChat };
};

type TelegramEnvelope<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: noStoreHeaders });
}

function token() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

function publicDashboardUrl(request: Request) {
  const value = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() || new URL(request.url).origin;
  try {
    const url = new URL(value);
    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    return !localHost && (url.protocol === "https:" || url.protocol === "http:") ? url.toString() : null;
  } catch {
    return null;
  }
}

async function telegram<T>(method: string, init?: RequestInit) {
  const response = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json()) as TelegramEnvelope<T>;
  if (!response.ok || !payload.ok || payload.result === undefined) {
    throw new Error(payload.description || `Telegram API error (${response.status})`);
  }
  return payload.result;
}

function chatFromUpdate(update: TelegramUpdate) {
  const chat = update.message?.chat ?? update.edited_message?.chat ?? update.my_chat_member?.chat;
  return chat && (chat.type === "group" || chat.type === "supergroup") ? chat : null;
}

async function discoverGroup(): Promise<TelegramChat | null> {
  const configuredChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (configuredChatId) {
    return telegram<TelegramChat>("getChat", {
      method: "POST",
      body: JSON.stringify({ chat_id: configuredChatId }),
    });
  }

  const updates = await telegram<TelegramUpdate[]>("getUpdates", {
    method: "POST",
    body: JSON.stringify({ limit: 50, timeout: 0, allowed_updates: ["message", "edited_message", "my_chat_member"] }),
  });
  return updates.toReversed().map(chatFromUpdate).find(Boolean) ?? null;
}

export async function GET() {
  if (!token()) {
    return json({ configured: false, connected: false, error: "توکن بات تنظیم نشده است." }, 503);
  }

  try {
    const [bot, group] = await Promise.all([
      telegram<TelegramUser>("getMe"),
      discoverGroup(),
    ]);
    return json({
      configured: true,
      connected: Boolean(group),
      bot: { name: bot.first_name, username: bot.username ? `@${bot.username}` : bot.first_name },
      group: group ? { id: String(group.id), title: group.title || "گروه تلگرام", type: group.type } : null,
    });
  } catch (error) {
    return json({
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : "اتصال تلگرام ناموفق بود.",
    }, 502);
  }
}

export async function POST(request: Request) {
  if (!token()) return json({ ok: false, error: "توکن بات تنظیم نشده است." }, 503);

  try {
    const body = (await request.json().catch(() => ({}))) as { chatId?: string };
    let group: TelegramChat | null = null;
    if (body.chatId && /^-?\d+$/.test(body.chatId)) {
      group = await telegram<TelegramChat>("getChat", {
        method: "POST",
        body: JSON.stringify({ chat_id: body.chatId }),
      });
    } else {
      group = await discoverGroup();
    }

    if (!group) {
      return json({ ok: false, needsGroup: true, error: "هنوز پیامی از گروه دریافت نشده است." }, 409);
    }

    const dashboardUrl = publicDashboardUrl(request);
    const message: Record<string, unknown> = {
      chat_id: group.id,
      text: "✅ اتصال والت سوشال با موفقیت آزمایش شد.\n\nاز این پس اعلان پست‌های آماده، پاسخ‌های جدید، هشدار بودجه و خطاهای پایش در همین گروه ارسال می‌شوند.",
    };
    if (dashboardUrl) {
      message.reply_markup = { inline_keyboard: [[{ text: "بازکردن داشبورد", url: dashboardUrl }]] };
    }
    await telegram("sendMessage", {
      method: "POST",
      body: JSON.stringify(message),
    });

    return json({ ok: true, group: { id: String(group.id), title: group.title || "گروه تلگرام" } });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "ارسال اعلان ناموفق بود." }, 502);
  }
}
