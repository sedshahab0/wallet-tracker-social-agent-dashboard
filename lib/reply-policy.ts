export type ReplyRisk = "green" | "yellow" | "red";

export type ReplySuggestion = {
  risk: ReplyRisk;
  confidence: number;
  answer: string;
  groundingFacts: string[];
  needsHumanReview: boolean;
  reviewReasonFa: string;
};

const criticalSecurity = /(?:seed\s*phrase|private\s*key|recovery\s*phrase|mnemonic|secret\s*key|wallet\s*(?:was\s*)?(?:hacked|drained|stolen|compromised)|stolen\s*funds|سرقت|هک|کلید\s*خصوصی|عبارت\s*بازیابی|سید\s*فریز)/iu;
const liveSensitive = /(?:solana|base|network|chain|support(?:ed|s)?|available|availability|price|pricing|cost|roadmap|release|launch|when|eta|instant|latency|uptime|sla|filter|threshold|شبکه|سولانا|بیس|پشتیبانی|قیمت|هزینه|نقشه\s*راه|انتشار|عرضه|چه\s*زمان|فوری|تاخیر|تأخیر|فیلتر|آستانه)/iu;
const prohibitedClaims = /(?:guaranteed|zero[- ]delay|risk[- ]free|all\s*chains|any\s*chain|guaranteed\s*profit|instant\s*alerts?|تضمین(?:ی|\s*شده)?|بدون\s*ریسک|همه\s*شبکه|هر\s*شبکه|سود\s*قطعی|هشدار\s*فوری)/iu;
const secretRequest = /(?:send|share|paste|enter|give).{0,28}(?:seed|private\s*key|recovery\s*phrase|mnemonic|password|otp)|(?:بفرست|ارسال|وارد|بده).{0,28}(?:سید|کلید\s*خصوصی|عبارت\s*بازیابی|رمز|کد)/iu;

function limitCharacters(value: string, maximum: number) {
  return Array.from(value.trim()).slice(0, maximum).join("");
}

export function isSemiAutoReady(suggestion: ReplySuggestion) {
  return suggestion.risk === "green"
    && suggestion.confidence >= 95
    && !suggestion.needsHumanReview
    && suggestion.groundingFacts.length >= 1;
}

/**
 * Deterministic safety layer applied after the language model. The model may
 * draft prose, but it cannot downgrade security/runtime-sensitive replies or
 * publish unsupported absolutes as a green suggestion.
 */
export function applyReplySafety(mentionText: string, suggestion: ReplySuggestion): ReplySuggestion {
  const facts = suggestion.groundingFacts.map((fact) => fact.trim()).filter(Boolean).slice(0, 3);
  let risk = suggestion.risk;
  let needsHumanReview = suggestion.needsHumanReview;
  let reason = suggestion.reviewReasonFa.trim();

  if (criticalSecurity.test(mentionText) || secretRequest.test(suggestion.answer)) {
    risk = "red";
    needsHumanReview = true;
    reason ||= "موضوع امنیتی یا اطلاعات محرمانه است و باید توسط مدیر بررسی شود.";
  } else if (liveSensitive.test(mentionText) || prohibitedClaims.test(suggestion.answer) || facts.length === 0) {
    if (risk === "green") risk = "yellow";
    needsHumanReview = true;
    reason ||= prohibitedClaims.test(suggestion.answer)
      ? "متن شامل ادعای مطلق یا اثبات‌نشده است و قبل از انتشار باید اصلاح شود."
      : facts.length === 0
        ? "پاسخ بدون حقیقت داخلی قابل ردیابی تولید شده است."
        : "پاسخ به وضعیت زنده، شبکه، قیمت، زمان عرضه یا قابلیت نیازمند تأیید وابسته است.";
  }

  if (needsHumanReview && risk === "green") risk = "yellow";
  const confidence = Math.max(0, Math.min(risk === "red" ? 60 : needsHumanReview || risk === "yellow" ? 81 : 100, Math.round(suggestion.confidence)));
  return {
    ...suggestion,
    answer: limitCharacters(suggestion.answer, 240),
    groundingFacts: facts,
    risk,
    confidence,
    needsHumanReview,
    reviewReasonFa: reason,
  };
}
