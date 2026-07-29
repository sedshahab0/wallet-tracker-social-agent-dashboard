import { recordXaiChatUsage } from "@/lib/usage-tracker";

type ChatPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
};

export function xaiTextModel() {
  return process.env.XAI_TEXT_MODEL?.trim() || "grok-4.5";
}

export function xaiReasoningEffort() {
  const value = process.env.XAI_REASONING_EFFORT?.trim().toLowerCase();
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

export async function xaiChatCompletion(options: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}) {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) throw new Error("کلید xAI روی سرور تنظیم نشده است.");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: xaiTextModel(),
      reasoning_effort: xaiReasoningEffort(),
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: options.schemaName, strict: true, schema: options.schema },
      },
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
  });
  const payload = (await response.json().catch(() => ({}))) as ChatPayload;
  if (!response.ok) throw new Error(payload.error?.message || `xAI error (${response.status})`);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("xAI خروجی معتبری برنگرداند.");
  await recordXaiChatUsage({
    promptTokens: payload.usage?.prompt_tokens,
    completionTokens: payload.usage?.completion_tokens,
    totalTokens: payload.usage?.total_tokens,
  }).catch(() => undefined);
  return content;
}
