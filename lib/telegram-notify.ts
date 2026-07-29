type TelegramButton = { text: string; url: string };

export async function sendTelegramMessage(input: {
  text: string;
  buttons?: TelegramButton[];
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: input.text.slice(0, 3900),
  };
  if (input.buttons?.length) {
    payload.reply_markup = {
      inline_keyboard: [input.buttons.slice(0, 2)],
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

export function dashboardUrl(path: string, request?: Request) {
  const base = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() || (request ? new URL(request.url).origin : "");
  if (!base) return "";
  try {
    return new URL(path, base).toString();
  } catch {
    return "";
  }
}
