"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type View = "overview" | "replies" | "content" | "sent" | "telegram" | "research" | "budget" | "settings";
type Risk = "green" | "yellow" | "red";
type ReplyItem = {
  id: string;
  handle: string;
  avatar: string;
  language: string;
  age: string;
  sentiment: string;
  risk: Risk;
  confidence: number;
  original: string;
  translation: string;
  answer: string;
  answerTranslation: string;
};
type ContentItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  language: string;
  risk: Risk;
  time: string;
  source: string;
  postText: string;
};
type ResearchSource = {
  title: string;
  url: string;
  description: string;
};
type ResearchItem = {
  id: string;
  score: number;
  title: string;
  meta: string;
  tag: string;
  evidence: string[];
  sources?: ResearchSource[];
  summary?: string;
  completedAt?: string;
};
type TelegramConnection = {
  configured: boolean;
  connected: boolean;
  bot?: { name: string; username: string };
  group?: { id: string; title: string; type: string } | null;
  error?: string;
};

const X_ACCOUNT_HANDLE = "@wallettrackerH";
const X_ACCOUNT_URL = "https://x.com/wallettrackerH";
const SETTINGS_DEFAULTS = { polling: true, firecrawl: true, interval: "120", budget: "10.00", lowConfidence: true, externalClaims: true, importantAccounts: true };

const navGroups = [
  {
    label: "محیط کار",
    items: [
      { id: "overview" as View, icon: "⌂", label: "نمای کلی" },
      { id: "replies" as View, icon: "↩", label: "صندوق پاسخ‌ها", badge: "۱۲" },
      { id: "content" as View, icon: "≡", label: "صف محتوا", badge: "۷" },
      { id: "sent" as View, icon: "✓", label: "تاریخچه ارسال" },
    ],
  },
  {
    label: "هماهنگی تیم",
    items: [{ id: "telegram" as View, icon: "➤", label: "اعلان‌های تلگرام", badge: "۳" }],
  },
  {
    label: "هوشمندی",
    items: [
      { id: "research" as View, icon: "◇", label: "پژوهش زنده" },
      { id: "budget" as View, icon: "▥", label: "مصرف و بودجه" },
    ],
  },
  {
    label: "سیستم",
    items: [{ id: "settings" as View, icon: "⚙", label: "تنظیمات" }],
  },
];

const viewMeta: Record<View, { title: string; sub: string }> = {
  overview: { title: "نمای کلی", sub: "مرکز زنده مدیریت محتوا و ارتباط با کاربران در X" },
  replies: { title: "صندوق پاسخ‌ها", sub: "پاسخ‌های چندزبانه را پیش از ارسال توسط اپراتور بررسی کنید." },
  content: { title: "صف محتوا", sub: "پست‌های پیشنهادی را از یک محل بررسی، ویرایش و زمان‌بندی کنید." },
  sent: { title: "تاریخچه ارسال", sub: "همه پست‌ها و پاسخ‌هایی که اپراتور انتشار آن‌ها را تأیید کرده است." },
  telegram: { title: "اعلان‌های تلگرام", sub: "هشدارها، لینک‌های مستقیم و قوانین اطلاع‌رسانی گروه اپراتورها" },
  research: { title: "پژوهش زنده", sub: "سیگنال‌های منتخب Firecrawl برای تصمیم‌گیری محتوایی" },
  budget: { title: "مصرف و بودجه", sub: "هزینه X API و استفاده انتخابی از Firecrawl را کنترل کنید." },
  settings: { title: "تنظیمات", sub: "فاصله پایش، قوانین تأیید و محدودیت‌های هزینه را مدیریت کنید." },
};

const viewRoutes: Record<View, string> = {
  overview: "/",
  replies: "/replies",
  content: "/content",
  sent: "/history",
  telegram: "/telegram",
  research: "/research",
  budget: "/budget",
  settings: "/settings",
};

const routeViews: Record<string, View> = {
  "/": "overview",
  "/overview": "overview",
  "/replies": "replies",
  "/content": "content",
  "/history": "sent",
  "/sent": "sent",
  "/telegram": "telegram",
  "/research": "research",
  "/budget": "budget",
  "/settings": "settings",
};

function viewFromPathname(pathname: string): View {
  const normalized = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  return routeViews[normalized] || "overview";
}

const replies: ReplyItem[] = [
  {
    id: "r-2041",
    handle: "@carlos_chain",
    avatar: "CC",
    language: "اسپانیایی",
    age: "2m",
    sentiment: "پرسش محصول",
    risk: "green" as Risk,
    confidence: 96,
    original: "¿También puedo seguir wallets de Solana o solo funciona con Ethereum?",
    translation: "آیا می‌توانم کیف‌پول‌های سولانا را هم دنبال کنم یا فقط اتریوم پشتیبانی می‌شود؟",
    answer:
      "Sí, Wallet Tracker también admite wallets de Solana. Puedes añadir una dirección y recibir alertas de nuevas transacciones desde el mismo panel.",
    answerTranslation:
      "بله، Wallet Tracker از کیف‌پول‌های سولانا نیز پشتیبانی می‌کند. می‌توانید آدرس را اضافه کرده و اعلان تراکنش‌های جدید را در همان پنل دریافت کنید.",
  },
  {
    id: "r-2039",
    handle: "@noor_web3",
    avatar: "NW",
    language: "عربی",
    age: "7m",
    sentiment: "بازخورد محصول",
    risk: "green" as Risk,
    confidence: 93,
    original: "هل توجد تنبيهات فورية عند حدوث معاملة جديدة؟",
    translation: "آیا هنگام انجام یک تراکنش جدید، اعلان لحظه‌ای وجود دارد؟",
    answer:
      "نعم، يمكنك تفعيل التنبيهات الفورية لكل محفظة تتابعها وتخصيص نوع المعاملات التي تريد أن يصلك إشعار عنها.",
    answerTranslation:
      "بله، می‌توانید برای هر کیف‌پولی که دنبال می‌کنید اعلان لحظه‌ای را فعال کرده و نوع تراکنش‌های موردنظر را شخصی‌سازی کنید.",
  },
  {
    id: "r-2037",
    handle: "@chainwatcher",
    avatar: "CW",
    language: "انگلیسی",
    age: "11m",
    sentiment: "پرسش امنیتی",
    risk: "yellow" as Risk,
    confidence: 78,
    original: "Does the app store private keys when I add a wallet?",
    translation: "آیا اپلیکیشن هنگام افزودن کیف‌پول، کلید خصوصی را ذخیره می‌کند؟",
    answer:
      "No. Wallet Tracker only needs a public wallet address for monitoring. Never share your seed phrase or private key with any tracking service.",
    answerTranslation:
      "خیر. Wallet Tracker فقط برای پایش به آدرس عمومی کیف‌پول نیاز دارد. عبارت بازیابی یا کلید خصوصی خود را هرگز با هیچ سرویس رهگیری به اشتراک نگذارید.",
  },
];

const contentItems: ContentItem[] = [
  {
    id: "p-301",
    type: "به‌روزرسانی محصول",
    title: "رهگیری کیف‌پول‌های سولانا فعال شد",
    body: "آدرس‌های سولانا را در کنار کیف‌پول‌های EVM دنبال کنید و برای تراکنش‌های جدید اعلان بگیرید.",
    language: "انگلیسی",
    risk: "green" as Risk,
    time: "امروز · ۱۸:۳۰",
    source: "نسخه GitLab و مستندات محصول",
    postText: "Solana wallet tracking is now live in Wallet Tracker. Monitor Solana and EVM addresses side by side, and get notified when new transactions happen. Add your first Solana address from the dashboard.",
  },
  {
    id: "p-300",
    type: "رشته‌پست آموزشی",
    title: "۵ نشانه مهم برای بررسی یک کیف‌پول",
    body: "راهنمایی کاربردی درباره انتقال‌های بزرگ، فعالیت کیف‌پول‌های غیرفعال و تمرکز توکن؛ بدون تبدیل داده به توصیه مالی.",
    language: "انگلیسی",
    risk: "green" as Risk,
    time: "فردا · ۱۱:۰۰",
    source: "پایگاه دانش تأییدشده",
    postText: "5 wallet signals worth watching — without turning data into financial advice:\n\n1. Large transfers\n2. Dormant wallet activity\n3. Token concentration\n4. Repeated counterparties\n5. Sudden balance changes\n\nWallet Tracker keeps these signals in one clear timeline.",
  },
  {
    id: "p-299",
    type: "سیگنال بازار",
    title: "یک انتقال باارزش در شبکه اتریوم شناسایی شد",
    body: "یک کیف‌پول عمومی دارایی قابل‌توجهی منتقل کرده است. مبلغ و مقصد هنوز به بررسی با منبع دوم نیاز دارد.",
    language: "انگلیسی",
    risk: "yellow" as Risk,
    time: "منتظر بررسی",
    source: "Wallet Stats و بررسی RPC",
    postText: "A notable public-wallet transfer was detected on Ethereum. The amount and destination are still being verified against a second source. We will only publish confirmed details.",
  },
];

const telegramAlerts = [
  { id: "t-1", icon: "✦", tone: "ready", title: "پست جدید آماده انتشار است", body: "پست «رهگیری کیف‌پول‌های سولانا» بررسی شده؛ متن را از داشبورد کپی کنید.", time: "۲ دقیقه پیش", cta: "دیدن پست", target: "content" as View },
  { id: "t-2", icon: "↩", tone: "ready", title: "پاسخ اسپانیایی آماده است", body: "@carlos_chain درباره پشتیبانی سولانا پرسیده است. پاسخ هم‌زبان با ریسک پایین آماده شد.", time: "۷ دقیقه پیش", cta: "دیدن پاسخ", target: "replies" as View },
  { id: "t-3", icon: "!", tone: "danger", title: "ارجاع امنیتی به مدیر", body: "یک پیام شامل درخواست کلید خصوصی شناسایی شد؛ انتشار خودکار پاسخ مسدود است.", time: "۱۲ دقیقه پیش", cta: "بررسی فوری", target: "replies" as View },
  { id: "t-4", icon: "$", tone: "warning", title: "بودجه به ۴۲٪ رسیده است", body: "۴٫۲۰ دلار از سقف ۱۰ دلار مصرف شده؛ هشدار بعدی در ۵ دلار ارسال می‌شود.", time: "۱ ساعت پیش", cta: "دیدن بودجه", target: "budget" as View },
];

const defaultResearchItems: ResearchItem[] = [
  { id: "research-security", score: 92, title: "پرسش‌های امنیت کیف‌پول در حال افزایش است", meta: "۱۸ پست X · ۷ منبع · انگلیسی و اسپانیایی", tag: "فرصت محتوایی", evidence: ["۷ منبع عمومی مستقل بررسی شده‌اند.", "پرسش‌های پرتکرار درباره کلید خصوصی و عبارت بازیابی بوده‌اند.", "پیشنهاد: یک رشته‌پست آموزشی بدون توصیه مالی آماده شود."] },
  { id: "research-solana", score: 86, title: "اعتمادپذیری اعلان‌های سولانا یک دغدغه پرتکرار است", meta: "۱۱ گفتگو · ۵ منبع · ۱۲ ساعت", tag: "آموزش محصول", evidence: ["۱۱ گفتگو در بازه ۱۲ ساعته دسته‌بندی شده‌اند.", "بیشترین ابهام مربوط به زمان دریافت اعلان است.", "پیشنهاد: تفاوت تأیید شبکه و اعلان اپلیکیشن توضیح داده شود."] },
  { id: "research-base", score: 74, title: "یکی از رقبا پشتیبانی از Base را اضافه کرد", meta: "نسخه تأیید شد · ۳ منشن پشتیبان", tag: "سیگنال رقابتی", evidence: ["صفحه رسمی محصول و یادداشت نسخه با یکدیگر تطبیق داده شدند.", "سه گفتگوی عمومی قابلیت جدید را تأیید می‌کنند.", "این سیگنال پیش از ورود به صف محتوا به بررسی محصول نیاز دارد."] },
];

function useStoredIds(key: string) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try { setIds(JSON.parse(window.localStorage.getItem(key) || "[]")); } catch { setIds([]); }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, [key]);
  useEffect(() => { if (ready) window.localStorage.setItem(key, JSON.stringify(ids)); }, [ids, key, ready]);
  const mark = (id: string) => setIds((current) => current.includes(id) ? current : [...current, id]);
  return { ids, mark };
}

function useStoredCollection<T>(key: string, initialItems: T[]) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(key) || "null");
        if (Array.isArray(stored) && stored.length) setItems(stored as T[]);
      } catch {
        setItems(initialItems);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, [key, initialItems]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(key, JSON.stringify(items));
  }, [items, key, ready]);
  return { items, setItems };
}

function ModalShell({ title, eyebrow, children, footer, onClose, closeDisabled = false }: { title: string; eyebrow: string; children: ReactNode; footer: ReactNode; onClose: () => void; closeDisabled?: boolean }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onCloseRef.current();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [closeDisabled]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (!closeDisabled && event.currentTarget === event.target) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="dashboard-modal-title">
        <header className="modal-head">
          <div><span className="eyebrow">{eyebrow}</span><h2 id="dashboard-modal-title">{title}</h2></div>
          <button ref={closeButton} className="modal-close" type="button" onClick={onClose} aria-label="بستن پنجره" disabled={closeDisabled}>×</button>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-footer">{footer}</footer>
      </section>
    </div>,
    document.body,
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  const label = risk === "green" ? "کم‌ریسک" : risk === "yellow" ? "نیازمند بررسی" : "ارجاع فوری";
  return <span className={`risk-badge ${risk}`}><i />{label}</span>;
}

function ViewSkeleton() {
  return (
    <div className="view-skeleton" aria-label="در حال بارگذاری" aria-busy="true">
      <div className="skeleton skeleton-hero"><i /><i className="short" /><i className="medium" /></div>
      <div className="skeleton-kpis">
        {[1, 2, 3, 4].map((item) => <div className="skeleton skeleton-kpi" key={item}><i className="short" /><i className="number" /><i className="medium" /></div>)}
      </div>
      <div className="skeleton-main">
        <div className="skeleton skeleton-panel large">
          <i className="short" /><i className="medium" />
          {[1, 2, 3].map((item) => <span className="skeleton-row" key={item}><b /><i /><em /></span>)}
        </div>
        <div className="skeleton skeleton-panel"><i className="short" /><span className="skeleton-circle" /><i className="medium" /><i className="short" /></div>
      </div>
    </div>
  );
}

function Overview({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <>
      <section className="operation-banner">
        <div>
          <span className="eyebrow">وضعیت امروز</span>
          <h2>میز مدیریت شبکه اجتماعی فعال است.</h2>
          <p>پایش Owned Reads بدون مشکل کار می‌کند و سه پاسخ چندزبانه برای تصمیم اپراتور آماده است.</p>
        </div>
        <div className="banner-actions">
          <button className="btn quiet" onClick={() => onNavigate("content")}>بررسی محتوا</button>
          <button className="btn accent" onClick={() => onNavigate("replies")}>بازکردن صندوق پاسخ‌ها <span>←</span></button>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-top"><span>پاسخ‌های منتظر</span><i className="signal cyan" /></div>
          <strong>۱۲</strong><small><b>۳ مورد مهم</b> · قدیمی‌ترین ۱۱ دقیقه</small>
        </article>
        <article className="kpi-card">
          <div className="kpi-top"><span>پیش‌نویس‌های محتوا</span><i className="signal blue" /></div>
          <strong>۷</strong><small><b>۴ مورد کم‌ریسک</b> · ۲ مورد نیازمند بررسی</small>
        </article>
        <article className="kpi-card">
          <div className="kpi-top"><span>میانه زمان پاسخ</span><i className="signal violet" /></div>
          <strong>۶ دقیقه</strong><small><b>۱۸٪ بهتر</b> از هفته گذشته</small>
        </article>
        <article className="kpi-card budget-kpi">
          <div className="kpi-top"><span>بودجه X API</span><i className="signal amber" /></div>
          <strong>۴٫۲۰ دلار <em>از ۱۰ دلار</em></strong>
          <div className="mini-progress"><span style={{ width: "42%" }} /></div>
          <small>۴۲٪ مصرف شده · هشدار اول در ۵ دلار</small>
        </article>
      </section>

      <section className="main-grid">
        <article className="panel reply-preview span-2">
          <div className="panel-head">
            <div><span className="eyebrow">بررسی انسانی</span><h3>پاسخ‌های مهم</h3><p>پاسخ هم‌زبان کاربر، همراه با ترجمه فارسی برای اپراتور</p></div>
            <button className="text-btn" onClick={() => onNavigate("replies")}>مشاهده همه پاسخ‌ها ←</button>
          </div>
          <div className="reply-rows">
            {replies.map((reply) => (
              <button className="reply-row" key={reply.id} onClick={() => onNavigate("replies")}> 
                <span className="avatar">{reply.avatar}</span>
                <span className="reply-copy"><strong>{reply.handle}</strong><small>{reply.original}</small></span>
                <span className="language-chip">{reply.language}</span>
                <RiskBadge risk={reply.risk} />
                <time>{reply.age}</time>
                <span className="row-arrow">‹</span>
              </button>
            ))}
          </div>
        </article>

        <article className="panel polling-panel">
          <div className="panel-head"><div><span className="eyebrow">Owned Reads</span><h3>وضعیت پایش</h3></div><span className="live-pill"><i /> فعال</span></div>
          <div className="poll-visual"><div className="radar"><span /><span /><i /></div><strong>هر ۲ دقیقه</strong><small>بررسی بعدی تا ۰۱:۱۸</small></div>
          <div className="stat-list">
            <div><span>آخرین بررسی موفق</span><strong>۴۲ ثانیه قبل</strong></div>
            <div><span>منشن‌های یکتای امروز</span><strong>۳۸</strong></div>
            <div><span>جلوگیری از خواندن تکراری</span><strong>۱۲۴</strong></div>
          </div>
        </article>
      </section>

      <section className="lower-grid">
        <article className="panel agent-panel">
          <div className="panel-head"><div><span className="eyebrow">گردش‌کار عامل</span><h3>عامل‌های فعال</h3></div></div>
          <div className="agent-list">
            <div><i className="agent-icon cyan">◎</i><span><strong>تشخیص زبان و هدف</strong><small>۱۲ مورد دسته‌بندی شده</small></span><b>فعال</b></div>
            <div><i className="agent-icon blue">✦</i><span><strong>نویسنده پاسخ</strong><small>۳ پیش‌نویس ساخته شده</small></span><b>فعال</b></div>
            <div><i className="agent-icon violet">◇</i><span><strong>کنترل ریسک و قوانین</strong><small>۱ مورد ارجاع شده</small></span><b>فعال</b></div>
            <div><i className="agent-icon amber">F</i><span><strong>کانتکست Firecrawl</strong><small>۲ بررسی انتخابی</small></span><b>آماده‌به‌کار</b></div>
          </div>
        </article>

        <article className="panel budget-panel">
          <div className="panel-head"><div><span className="eyebrow">کنترل هزینه</span><h3>بودجه ماهانه</h3></div><button className="text-btn" onClick={() => onNavigate("budget")}>جزئیات ←</button></div>
          <div className="budget-ring"><div><strong>۴۲٪</strong><small>۴٫۲۰ دلار مصرف</small></div></div>
          <div className="thresholds"><span><i className="line half" />هشدار ۵۰٪ · ۵ دلار</span><span><i className="line danger" />هشدار ۸۰٪ · ۸ دلار</span></div>
        </article>

        <article className="panel intelligence-panel">
          <div className="panel-head"><div><span className="eyebrow">Firecrawl</span><h3>سیگنال‌های منتخب</h3></div><button className="text-btn" onClick={() => onNavigate("research")}>پژوهش ←</button></div>
          <div className="signal-list">
            <div><span className="source-mark">X</span><span><strong>افزایش گفتگو درباره امنیت کیف‌پول</strong><small>۱۸ پست عمومی مرتبط · ۲۴ ساعت</small></span></div>
            <div><span className="source-mark">R</span><span><strong>رقیب از شبکه Base پشتیبانی کرد</strong><small>نسخه منتشرشده تأیید شد · ۳ ساعت</small></span></div>
            <div><span className="source-mark">N</span><span><strong>فرصت تولید محتوا درباره سولانا</strong><small>۶ منبع معتبر · ۷ ساعت</small></span></div>
          </div>
        </article>
      </section>
    </>
  );
}

function RepliesView({ replyItems, onRepliesChange, sentIds, onMarkSent }: { replyItems: ReplyItem[]; onRepliesChange: (items: ReplyItem[]) => void; sentIds: string[]; onMarkSent: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState(replyItems[0]?.id || "");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("all");
  const [toast, setToast] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editAnswer, setEditAnswer] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const escalated = useStoredIds("wallet-social-escalated-replies");
  const languages = useMemo(() => Array.from(new Set(replyItems.map((item) => item.language))), [replyItems]);
  const visibleReplies = useMemo(() => replyItems.filter((item) => {
    const matchesLanguage = language === "all" || item.language === language;
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || `${item.handle} ${item.original} ${item.translation}`.toLocaleLowerCase().includes(query);
    return matchesLanguage && matchesSearch;
  }), [language, replyItems, search]);
  const reply = visibleReplies.find((item) => item.id === selectedId) || visibleReplies[0] || replyItems.find((item) => item.id === selectedId) || replyItems[0];
  if (!reply) return <div className="panel empty-state"><strong>پاسخی در صف نیست.</strong><p>پس از دریافت نخستین پاسخ، جزئیات آن در این بخش نمایش داده می‌شود.</p></div>;
  const isSent = sentIds.includes(reply.id);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const copyAnswer = async () => {
    await navigator.clipboard?.writeText(reply.answer);
    notify("پاسخ کپی شد؛ حالا آن را در X ارسال کنید");
  };

  const openEditor = () => {
    setEditAnswer(reply.answer);
    setEditTranslation(reply.answerTranslation);
    setEditorOpen(true);
  };

  const saveReply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editAnswer.trim()) return;
    onRepliesChange(replyItems.map((item) => item.id === reply.id ? { ...item, answer: editAnswer.trim(), answerTranslation: editTranslation.trim() } : item));
    setEditorOpen(false);
    notify("نسخه ویرایش‌شده پاسخ ذخیره شد");
  };

  const escalateReply = () => {
    escalated.mark(reply.id);
    notify("پاسخ برای بررسی مدیر علامت‌گذاری شد");
  };

  return (
    <section className="inbox-layout">
      <article className="panel inbox-list-panel">
        <div className="panel-head inbox-head"><div><span className="eyebrow">{visibleReplies.length} مورد در این نما</span><h3>پاسخ‌های دریافتی</h3></div><select className="filter-btn" value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="فیلتر زبان"><option value="all">همه زبان‌ها</option>{languages.map((item) => <option value={item} key={item}>{item}</option>)}</select></div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی پاسخ یا نام کاربر…" /></label>
        <div className="inbox-list">
          {visibleReplies.map((item) => (
            <button key={item.id} className={`inbox-item ${reply.id === item.id ? "active" : ""} ${sentIds.includes(item.id) ? "handled" : ""}`} onClick={() => { setSelectedId(item.id); setMoreOpen(false); }}>
              <span className="avatar">{item.avatar}</span>
              <span><strong>{item.handle}</strong><small>{item.original}</small><em>{item.language} · {item.age}</em></span>
              {sentIds.includes(item.id) ? <span className="sent-chip">ارسال‌شده</span> : <RiskBadge risk={escalated.ids.includes(item.id) ? "red" : item.risk} />}
            </button>
          ))}
          {visibleReplies.length === 0 && <div className="empty-state compact"><strong>پاسخی پیدا نشد.</strong><p>عبارت جست‌وجو یا فیلتر زبان را تغییر دهید.</p></div>}
        </div>
      </article>

      <article className="panel conversation-panel">
        <div className="conversation-motion" key={reply.id}>
        <div className="conversation-head">
              <div className="identity"><span className="avatar large">{reply.avatar}</span><div><strong>{reply.handle}</strong><small>{reply.language} · {reply.sentiment} · {reply.age} قبل</small></div></div>
          <div><RiskBadge risk={escalated.ids.includes(reply.id) ? "red" : reply.risk} /><div className="action-menu-wrap"><button className={`icon-button ${moreOpen ? "active" : ""}`} onClick={() => setMoreOpen((value) => !value)} aria-label="اقدام‌های بیشتر" aria-expanded={moreOpen}>•••</button>{moreOpen && <div className="action-menu"><button onClick={async () => { await navigator.clipboard?.writeText(reply.original); setMoreOpen(false); notify("متن اصلی کاربر کپی شد"); }}>کپی متن کاربر</button><button onClick={() => { setMoreOpen(false); window.open(`https://x.com/${reply.handle.replace("@", "")}`, "_blank", "noopener,noreferrer"); }}>مشاهده پروفایل در X ↗</button></div>}</div></div>
        </div>
        <div className="original-post">
          <span className="context-label">پاسخ دریافت‌شده</span>
          <blockquote dir="auto">{reply.original}</blockquote>
          <div className="translation"><span>ترجمه برای اپراتور</span><p dir="rtl">{reply.translation}</p></div>
        </div>
        <div className="answer-card">
          <div className="answer-top"><div><span className="eyebrow">پاسخ پیشنهادی · {reply.language}</span><h3>آماده بررسی انسانی</h3></div><span className="confidence">اطمینان {reply.confidence}٪</span></div>
          <div className="answer-text" dir="auto">{reply.answer}</div>
          <div className="translation answer-translation"><span>ترجمه پاسخ</span><p dir="rtl">{reply.answerTranslation}</p></div>
          <div className="source-strip"><span>منابع</span><b>پایگاه دانش محصول</b><b>قوانین پشتیبانی نسخه ۱٫۳</b></div>
          <div className="operator-steps" aria-label="مراحل اپراتور"><span><b>۱</b> پاسخ را کپی کن</span><span><b>۲</b> گفتگو را در X باز کن</span><span><b>۳</b> ارسال را ثبت کن</span></div>
          <div className="answer-actions">
            <button className="btn quiet" onClick={openEditor}>ویرایش پاسخ</button>
            <button className={`btn quiet ${escalated.ids.includes(reply.id) ? "done" : ""}`} disabled={escalated.ids.includes(reply.id)} onClick={escalateReply}>{escalated.ids.includes(reply.id) ? "✓ ارجاع شد" : "ارجاع به مدیر"}</button>
            <button className="btn accent" onClick={copyAnswer}>کپی پاسخ</button>
            <button className="btn primary" onClick={() => window.open("https://x.com/", "_blank", "noopener,noreferrer")}>بازکردن گفتگو در X ↗</button>
            <button className={`btn sent-action ${isSent ? "done" : ""}`} disabled={isSent} onClick={() => { onMarkSent(reply.id); notify("پاسخ به‌عنوان ارسال‌شده ثبت شد"); }}>{isSent ? "✓ پاسخ ارسال شده است" : "من این پاسخ را ارسال کردم"}</button>
          </div>
        </div>
        </div>
      </article>
      {toast && <div className="toast">✓ {toast}</div>}
      {editorOpen && <ModalShell title={`ویرایش پاسخ به ${reply.handle}`} eyebrow={`پاسخ ${reply.language}`} onClose={() => setEditorOpen(false)} footer={<><button className="btn quiet" type="button" onClick={() => setEditorOpen(false)}>انصراف</button><button className="btn accent" type="submit" form="reply-editor-form" disabled={!editAnswer.trim()}>ذخیره پاسخ</button></>}><form id="reply-editor-form" className="modal-form" onSubmit={saveReply}><div className="modal-context"><span>پیام اصلی کاربر</span><p dir="auto">{reply.original}</p></div><label>پاسخ پیشنهادی به زبان کاربر<textarea value={editAnswer} onChange={(event) => setEditAnswer(event.target.value)} dir="auto" rows={5} autoFocus /></label><label>ترجمه فارسی برای اپراتور<textarea value={editTranslation} onChange={(event) => setEditTranslation(event.target.value)} dir="rtl" rows={4} /></label><div className="modal-hint"><i /> تغییرات فقط در داشبورد ذخیره می‌شود و هیچ پاسخی خودکار در X منتشر نخواهد شد.</div></form></ModalShell>}
    </section>
  );
}

function ContentView({ content, onContentChange, sentIds, onMarkSent }: { content: ContentItem[]; onContentChange: (items: ContentItem[]) => void; sentIds: string[]; onMarkSent: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | Risk>("all");
  const [status, setStatus] = useState<"all" | "ready" | "sent">("all");
  const [toast, setToast] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ContentItem>({ id: "", type: "به‌روزرسانی محصول", title: "", body: "", language: "انگلیسی", risk: "green", time: "زمان‌بندی نشده", source: "", postText: "" });
  const items = useMemo(() => content.filter((item) => filter === "all" || item.risk === filter), [content, filter]);
  const visibleItems = items.filter((item) => status === "all" || (status === "sent") === sentIds.includes(item.id));
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  const copyPost = async (text: string) => { await navigator.clipboard?.writeText(text); notify("متن پست کپی شد؛ آن را در X منتشر کنید"); };
  const openEditor = (item?: ContentItem) => {
    setDraft(item ? { ...item } : { id: "", type: "به‌روزرسانی محصول", title: "", body: "", language: "انگلیسی", risk: "green", time: "زمان‌بندی نشده", source: "", postText: "" });
    setEditorOpen(true);
  };
  const saveContent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.postText.trim() || draft.postText.length > 280) return;
    if (draft.id) {
      onContentChange(content.map((item) => item.id === draft.id ? { ...draft, title: draft.title.trim(), postText: draft.postText.trim() } : item));
      notify("تغییرات پیش‌نویس ذخیره شد");
    } else {
      onContentChange([{ ...draft, id: `p-${Date.now()}`, title: draft.title.trim(), postText: draft.postText.trim() }, ...content]);
      notify("پیش‌نویس جدید به صف محتوا اضافه شد");
    }
    setEditorOpen(false);
  };
  return (
    <section>
      <div className="section-toolbar">
        <div className="toolbar-filters">
          <div className="segmented">
            {(["all", "green", "yellow", "red"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "همه ریسک‌ها" : item === "green" ? "کم‌ریسک" : item === "yellow" ? "نیازمند بررسی" : "ارجاع‌شده"}</button>)}
          </div>
          <div className="segmented">
            {(["all", "ready", "sent"] as const).map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item === "all" ? "همه وضعیت‌ها" : item === "ready" ? "آماده انتشار" : "ارسال‌شده"}</button>)}
          </div>
        </div>
        <button className="btn accent" onClick={() => openEditor()}>＋ پیش‌نویس جدید</button>
      </div>
      <div className="content-grid" key={`${filter}-${status}`}>
        {visibleItems.map((item) => {
          const isSent = sentIds.includes(item.id);
          return <article className={`panel content-card ${isSent ? "is-sent" : ""}`} key={item.id}>
            <div className="content-card-top"><span className="content-type">{item.type}</span>{isSent ? <span className="sent-chip">✓ منتشرشده</span> : <RiskBadge risk={item.risk} />}</div>
            <h3>{item.title}</h3><p>{item.body}</p>
            <div className="content-meta"><span>{item.language}</span><span>{item.time}</span></div>
            <div className="source-box"><span>منبع</span><strong>{item.source}</strong></div>
            <div className="publish-copy" dir="auto"><span>متن نهایی برای X</span><p>{item.postText}</p></div>
            <div className="operator-steps compact"><span><b>۱</b> کپی</span><span><b>۲</b> انتشار در X</span><span><b>۳</b> ثبت در داشبورد</span></div>
            <div className="card-actions"><button className="btn quiet" onClick={() => openEditor(item)}>ویرایش</button><button className="btn accent" onClick={() => copyPost(item.postText)}>کپی متن</button><button className="btn primary" onClick={() => window.open("https://x.com/compose/post", "_blank", "noopener,noreferrer")}>بازکردن X ↗</button><button className={`btn sent-action ${isSent ? "done" : ""}`} disabled={isSent} onClick={() => { onMarkSent(item.id); notify("پست به‌عنوان منتشرشده ثبت شد"); }}>{isSent ? "✓ انتشار ثبت شد" : "من این پست را منتشر کردم"}</button></div>
          </article>;
        })}
      </div>
      {visibleItems.length === 0 && <div className="panel empty-state"><strong>موردی با این فیلتر پیدا نشد.</strong><p>فیلتر وضعیت یا ریسک را تغییر دهید.</p></div>}
      {toast && <div className="toast">✓ {toast}</div>}
      {editorOpen && <ModalShell title={draft.id ? "ویرایش پیش‌نویس" : "ساخت پیش‌نویس جدید"} eyebrow="صف محتوا" onClose={() => setEditorOpen(false)} footer={<><button className="btn quiet" type="button" onClick={() => setEditorOpen(false)}>انصراف</button><button className="btn accent" type="submit" form="content-editor-form" disabled={!draft.title.trim() || !draft.postText.trim() || draft.postText.length > 280}>{draft.id ? "ذخیره تغییرات" : "افزودن به صف"}</button></>}><form id="content-editor-form" className="modal-form" onSubmit={saveContent}><div className="form-grid"><label>نوع محتوا<input value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} /></label><label>زبان<select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })}><option>انگلیسی</option><option>فارسی</option><option>اسپانیایی</option><option>عربی</option></select></label><label className="full-row">عنوان داخلی<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} autoFocus /></label><label className="full-row">خلاصه برای اپراتور<textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={3} /></label><label>زمان انتشار<input value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label><label>سطح ریسک<select value={draft.risk} onChange={(event) => setDraft({ ...draft, risk: event.target.value as Risk })}><option value="green">کم‌ریسک</option><option value="yellow">نیازمند بررسی</option><option value="red">ارجاع فوری</option></select></label><label className="full-row">منبع<input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label><label className="full-row">متن نهایی برای X<textarea value={draft.postText} onChange={(event) => setDraft({ ...draft, postText: event.target.value })} dir="auto" rows={6} /></label></div><div className={`character-count ${draft.postText.length > 280 ? "over" : ""}`}><span>{draft.postText.length.toLocaleString("fa-IR")} / ۲۸۰ نویسه</span><small>{draft.postText.length > 280 ? "متن باید کوتاه‌تر شود." : "قبل از انتشار، متن توسط اپراتور بررسی می‌شود."}</small></div></form></ModalShell>}
    </section>
  );
}

function SentView({ replyIds, postIds, replyItems, content }: { replyIds: string[]; postIds: string[]; replyItems: ReplyItem[]; content: ContentItem[] }) {
  const records = [
    ...content.filter((item) => postIds.includes(item.id)).map((item) => ({ id: item.id, type: "پست", title: item.title, detail: item.postText, language: item.language })),
    ...replyItems.filter((item) => replyIds.includes(item.id)).map((item) => ({ id: item.id, type: "پاسخ", title: `پاسخ به ${item.handle}`, detail: item.answer, language: item.language })),
  ];
  return <section>
    <div className="history-summary">
      <article className="panel"><span>ثبت‌شده امروز</span><strong>{records.length}</strong><small>توسط میز اپراتور</small></article>
      <article className="panel"><span>پست منتشرشده</span><strong>{postIds.length}</strong><small>دارای تأیید انسانی</small></article>
      <article className="panel"><span>پاسخ ارسال‌شده</span><strong>{replyIds.length}</strong><small>با زبان اصلی کاربر</small></article>
    </div>
    <article className="panel history-panel">
      <div className="panel-head"><div><span className="eyebrow">گزارش عملیات</span><h3>ارسال‌های تأییدشده اپراتور</h3><p>در نسخه نهایی، زمان دقیق، کاربر انجام‌دهنده و لینک X در Audit Log ثبت می‌شود.</p></div></div>
      {records.length === 0 ? <div className="empty-state"><strong>هنوز ارسالی ثبت نشده است.</strong><p>پس از انتشار در X، دکمه «من ارسال کردم» را در صف محتوا یا صندوق پاسخ‌ها بزنید.</p></div> : <div className="history-list">{records.map((record) => <div className="history-row" key={record.id}><span className={`history-icon ${record.type === "پست" ? "post" : "reply"}`}>{record.type === "پست" ? "≡" : "↩"}</span><div><strong>{record.title}</strong><p dir="auto">{record.detail}</p><small>{record.language} · میز اپراتور · همین حالا</small></div><span className="sent-chip">✓ ثبت‌شده</span><button className="btn quiet" onClick={() => window.open("https://x.com/", "_blank", "noopener,noreferrer")}>دیدن در X ↗</button></div>)}</div>}
    </article>
  </section>;
}

function TelegramView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const notificationRules = [
    ["پست یا پاسخ آماده", "فوری", true],
    ["ارجاع امنیتی، حقوقی یا مالی", "فوری و سنجاق‌شده", true],
    ["پاسخ بدون اقدام بیش از ۱۵ دقیقه", "یادآوری", true],
    ["بودجه X در ۵۰٪، ۸۰٪ و ۱۰۰٪", "فوری", true],
    ["توقف Poller یا خطای OAuth", "پس از ۳ خطا", true],
    ["خطای Firecrawl یا اعتبار کم", "فقط موارد منتخب", true],
    ["کپی‌شده ولی ثبت‌نشده", "بعد از ۱۵ دقیقه", true],
    ["خلاصه صف، هزینه و عملکرد", "روزانه ساعت ۱۸", true],
  ] as const;
  const [enabled, setEnabled] = useState(notificationRules.map((rule) => rule[2]));
  const [connection, setConnection] = useState<TelegramConnection | null>(null);
  const [checking, setChecking] = useState(true);
  const [sending, setSending] = useState(false);
  const [telegramNotice, setTelegramNotice] = useState("");

  const refreshConnection = async () => {
    setChecking(true);
    setTelegramNotice("");
    try {
      const response = await fetch("/api/telegram", { cache: "no-store" });
      const data = await response.json() as TelegramConnection;
      setConnection(data);
      if (!data.connected) setTelegramNotice("برای شناسایی گروه، دستور اتصال را یک‌بار در همان گروه ارسال کنید.");
    } catch {
      setConnection({ configured: false, connected: false, error: "داشبورد نتوانست وضعیت تلگرام را دریافت کند." });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const connectionTimer = window.setTimeout(() => void refreshConnection(), 0);
    return () => window.clearTimeout(connectionTimer);
  }, []);

  const testTelegram = async () => {
    if (!connection?.connected) {
      await refreshConnection();
      return;
    }
    setSending(true);
    setTelegramNotice("");
    try {
      const response = await fetch("/api/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId: connection.group?.id }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "ارسال اعلان ناموفق بود.");
      setTelegramNotice("اعلان آزمایشی با موفقیت در گروه ارسال شد.");
    } catch (error) {
      setTelegramNotice(error instanceof Error ? error.message : "ارسال اعلان ناموفق بود.");
    } finally {
      setSending(false);
    }
  };

  const botUsername = connection?.bot?.username || "@SocialWalletTrackerBot";
  const groupTitle = connection?.group?.title || "wallet-tracker-publisher";
  const isConnected = Boolean(connection?.connected);
  return <section className="telegram-layout">
    <article className="panel telegram-connection">
      <div className="telegram-brand"><span>➤</span><div><span className="eyebrow">مرکز هماهنگی اپراتور</span><h2>گروه تلگرام تیم عملیات X</h2><p>بات فقط اعلان و لینک مستقیم می‌فرستد؛ تصمیم نهایی و انتشار همیشه با نیروی انسانی است.</p></div></div>
      <div className="connection-state"><span className={`status-large ${isConnected ? "connected" : "waiting"}`}><i/> {checking ? "در حال بررسی" : isConnected ? "متصل و فعال" : "منتظر شناسایی گروه"}</span><div><span>نام بات</span><strong dir="ltr">{botUsername}</strong></div><div><span>گروه مقصد</span><strong>{groupTitle}</strong></div><button className="btn accent" disabled={checking || sending} onClick={() => void testTelegram()}>{sending ? "در حال ارسال…" : isConnected ? "آزمایش ارسال اعلان" : "شناسایی دوباره گروه"}</button></div>
      {!isConnected && !checking && <div className="telegram-setup"><strong>یک مرحله تا اتصال مانده</strong><p>در گروه تلگرام این دستور را ارسال کنید و سپس «شناسایی دوباره گروه» را بزنید:</p><code dir="ltr">/connect@SocialWalletTrackerBot</code></div>}
      {telegramNotice && <p className={`telegram-notice ${isConnected ? "success" : "warning"}`} role="status">{telegramNotice}</p>}
      <div className="deep-link-note"><strong>لینک مستقیم چگونه کار می‌کند؟</strong><p>هر اعلان شناسه همان پست یا پاسخ را دارد. اپراتور با لمس لینک، مستقیم به همان مورد در داشبورد می‌رسد؛ سپس متن را کپی، در X منتشر و ارسال را ثبت می‌کند.</p></div>
    </article>

    <article className="panel telegram-feed">
      <div className="panel-head"><div><span className="eyebrow">پیش‌نمایش گروه</span><h3>اعلان‌های اخیر</h3></div><span className="live-pill"><i/> ۳ خوانده‌نشده</span></div>
      <div className="telegram-messages">{telegramAlerts.map((alert) => <div className={`telegram-message ${alert.tone}`} key={alert.id}><span className="alert-icon">{alert.icon}</span><div><strong>{alert.title}</strong><p>{alert.body}</p><small>{alert.time}</small></div><button className="btn quiet" onClick={() => onNavigate(alert.target)}>{alert.cta} ←</button></div>)}</div>
    </article>

    <article className="panel notification-rules">
      <div className="panel-head"><div><span className="eyebrow">قوانین اعلان</span><h3>چه زمانی گروه مطلع شود؟</h3><p>اعلان‌های تکراری با کلید یکتا حذف می‌شوند تا گروه شلوغ نشود.</p></div></div>
      <div className="rule-list">{notificationRules.map((rule, index) => <div className="notification-rule" key={rule[0]}><button className={`switch ${enabled[index] ? "on" : ""}`} onClick={() => setEnabled((current) => current.map((value, currentIndex) => currentIndex === index ? !value : value))} aria-label={`فعال یا غیرفعال‌کردن ${rule[0]}`}><i/></button><div><strong>{rule[0]}</strong><small>{rule[1]}</small></div><span>{enabled[index] ? "فعال" : "خاموش"}</span></div>)}</div>
    </article>
  </section>;
}

function ResearchView() {
  const [researchItems, setResearchItems] = useState<ResearchItem[]>(defaultResearchItems);
  const [researchReady, setResearchReady] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<ResearchItem | null>(null);
  const [topic, setTopic] = useState("");
  const [sourceScope, setSourceScope] = useState("منابع رسمی و گفتگوهای عمومی X");
  const [runState, setRunState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [progressStep, setProgressStep] = useState(0);
  const [runError, setRunError] = useState("");
  const [completedResult, setCompletedResult] = useState<ResearchItem | null>(null);
  const [telegramNotified, setTelegramNotified] = useState(false);
  const [toast, setToast] = useState("");
  const running = runState === "running";
  const progressLabels = ["ارسال درخواست امن به Firecrawl", "جست‌وجو و جمع‌آوری منابع زنده", "حذف نتایج تکراری و آماده‌سازی شواهد", "ارسال اعلان پایان کار به تلگرام"];

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem("wallet-social-research-results") || "null");
        if (Array.isArray(stored) && stored.length) setResearchItems(stored);
      } catch {
        setResearchItems(defaultResearchItems);
      }
      setResearchReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);
  useEffect(() => {
    if (researchReady) window.localStorage.setItem("wallet-social-research-results", JSON.stringify(researchItems));
  }, [researchItems, researchReady]);

  const openResearch = () => {
    setRunState("idle");
    setRunError("");
    setCompletedResult(null);
    setTelegramNotified(false);
    setProgressStep(0);
    setResearchOpen(true);
  };
  const closeResearch = () => {
    if (!running) setResearchOpen(false);
  };
  const runResearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (topic.trim().length < 8 || running) return;
    setRunState("running");
    setRunError("");
    setProgressStep(0);
    const progressTimer = window.setInterval(() => {
      setProgressStep((step) => Math.min(step + 1, 2));
    }, 1900);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), scope: sourceScope }),
      });
      const data = await response.json() as { ok?: boolean; result?: ResearchItem; telegramNotified?: boolean; error?: string };
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error || "اجرای پژوهش ناموفق بود.");
      setProgressStep(3);
      setResearchItems((current) => [data.result!, ...current.filter((item) => item.id !== data.result!.id)]);
      setCompletedResult(data.result);
      setTelegramNotified(Boolean(data.telegramNotified));
      setRunState("success");
      setToast(data.telegramNotified ? "پژوهش تکمیل شد و تلگرام مطلع شد" : "پژوهش تکمیل شد؛ اعلان تلگرام ارسال نشد");
      window.setTimeout(() => setToast(""), 4200);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "اجرای پژوهش ناموفق بود.");
      setRunState("error");
    } finally {
      window.clearInterval(progressTimer);
    }
  };

  const modalFooter = runState === "running" ? (
    <button className="btn accent research-running-button" type="button" disabled><span className="button-spinner" /> پژوهش در حال اجراست…</button>
  ) : runState === "success" ? (
    <><button className="btn quiet" type="button" onClick={closeResearch}>بستن</button><button className="btn accent" type="button" onClick={() => { setResearchOpen(false); setSelectedEvidence(completedResult); }}>مشاهده نتیجه و منابع</button></>
  ) : runState === "error" ? (
    <><button className="btn quiet" type="button" onClick={closeResearch}>انصراف</button><button className="btn accent" type="button" onClick={() => setRunState("idle")}>اصلاح و تلاش دوباره</button></>
  ) : (
    <><button className="btn quiet" type="button" onClick={closeResearch}>انصراف</button><button className="btn accent" type="submit" form="research-request-form" disabled={topic.trim().length < 8}>شروع پژوهش</button></>
  );

  return (
    <section className="research-grid">
      <article className="panel research-hero"><span className="eyebrow">بررسی انتخابی</span><h2>Firecrawl فقط وقتی اجرا می‌شود که کانتکست ارزش هزینه را داشته باشد.</h2><p>پس از شروع، وضعیت پژوهش مرحله‌به‌مرحله نمایش داده می‌شود؛ نتیجه همراه منابع در همین صفحه می‌ماند و پایان کار در تلگرام اعلام می‌شود.</p><button className="btn accent" onClick={openResearch}>اجرای پژوهش هدفمند</button></article>
      {researchItems.map((item) => <article className="panel research-card" key={item.id}><div className="score">{item.score}</div><div><span>{item.tag}</span><h3>{item.title}</h3><p>{item.meta}</p></div><button className="text-btn" onClick={() => setSelectedEvidence(item)}>بررسی شواهد ←</button></article>)}
      {toast && <div className="toast">✓ {toast}</div>}
      {researchOpen && <ModalShell title={runState === "success" ? "پژوهش با موفقیت تکمیل شد" : runState === "error" ? "پژوهش تکمیل نشد" : running ? "پژوهش زنده در حال اجراست" : "پژوهش هدفمند جدید"} eyebrow="Firecrawl انتخابی" onClose={closeResearch} closeDisabled={running} footer={modalFooter}>
        {runState === "idle" && <form id="research-request-form" className="modal-form" onSubmit={runResearch}><label>موضوع یا پرسش پژوهش<textarea rows={4} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="مثلاً دغدغه‌های کاربران درباره امنیت کیف‌پول چیست؟" autoFocus maxLength={500} /></label><label>دامنه منابع<select value={sourceScope} onChange={(event) => setSourceScope(event.target.value)}><option>منابع رسمی و گفتگوهای عمومی X</option><option>فقط مستندات رسمی</option><option>منابع رسمی و وب‌سایت رقبا</option></select></label><div className="character-count"><span>{topic.trim().length.toLocaleString("fa-IR")} / ۵۰۰ نویسه</span><small>{topic.trim().length > 0 && topic.trim().length < 8 ? "پرسش را کمی دقیق‌تر بنویسید." : "پژوهش فقط با تأیید شما اجرا می‌شود."}</small></div><div className="modal-hint"><i /> نتیجه مستقیماً منتشر نمی‌شود؛ ابتدا شواهد برای بررسی انسانی در داشبورد ذخیره می‌شوند.</div></form>}
        {running && <div className="research-progress" aria-live="polite" aria-busy="true"><div className="research-orbit"><i /><span /><b /></div><div><strong>در حال بررسی «{topic.trim()}»</strong><p>این پنجره پس از تکمیل خودکار به نتیجه تغییر می‌کند.</p></div><ol>{progressLabels.map((label, index) => <li className={index < progressStep ? "done" : index === progressStep ? "active" : ""} key={label}><span>{index < progressStep ? "✓" : (index + 1).toLocaleString("fa-IR")}</span><div><strong>{label}</strong><small>{index < progressStep ? "انجام شد" : index === progressStep ? "در حال انجام…" : "در انتظار"}</small></div></li>)}</ol></div>}
        {runState === "success" && completedResult && <div className="research-complete"><span className="success-mark">✓</span><h3>{completedResult.title}</h3><p>{completedResult.summary}</p><div className="completion-stats"><span><b>{completedResult.sources?.length.toLocaleString("fa-IR") || "۰"}</b> منبع زنده</span><span className={telegramNotified ? "notified" : "warning"}><b>{telegramNotified ? "✓" : "!"}</b> {telegramNotified ? "اعلان تلگرام ارسال شد" : "اعلان تلگرام ارسال نشد"}</span></div></div>}
        {runState === "error" && <div className="research-error" role="alert"><span>!</span><div><strong>درخواست اجرا نشد</strong><p>{runError}</p><small>هیچ محتوایی منتشر نشده و می‌توانید متن را اصلاح و دوباره تلاش کنید.</small></div></div>}
      </ModalShell>}
      {selectedEvidence && <ModalShell title={selectedEvidence.title} eyebrow={`امتیاز ارتباط ${selectedEvidence.score} از ۱۰۰`} onClose={() => setSelectedEvidence(null)} footer={<button className="btn accent" type="button" onClick={() => setSelectedEvidence(null)}>متوجه شدم</button>}><div className="evidence-list">{selectedEvidence.evidence.map((evidence, index) => <div key={`${index}-${evidence}`}><span>{(index + 1).toLocaleString("fa-IR")}</span><p>{evidence}</p></div>)}</div>{selectedEvidence.sources?.length ? <div className="research-sources"><strong>منابع قابل بررسی</strong>{selectedEvidence.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><span>{source.title}</span><small>{source.url.replace(/^https?:\/\//, "").split("/")[0]} ↗</small></a>)}</div> : null}<div className="modal-context"><span>دامنه بررسی</span><p>{selectedEvidence.meta}</p></div></ModalShell>}
    </section>
  );
}

function BudgetView() {
  return (
    <section>
      <div className="budget-hero panel"><div><span className="eyebrow">تیر ۱۴۰۵</span><h2>۴٫۲۰ دلار از ۱۰ دلار</h2><p>با روند فعلی، مصرف پایان ماه حدود ۶٫۷۸ دلار خواهد بود.</p></div><div className="budget-bar-large"><span style={{width:"42%"}}/><i className="mark half">۵۰٪</i><i className="mark high">۸۰٪</i></div></div>
      <div className="usage-grid">
        <article className="panel usage-card"><span className="eyebrow">X Owned Reads</span><strong>۲٫۸۴ دلار</strong><p>۲٬۸۴۰ منشن یکتا</p><small>۰٫۰۰۱ دلار برای هر مورد</small></article>
        <article className="panel usage-card"><span className="eyebrow">پردازش هوش مصنوعی</span><strong>۰٫۹۱ دلار</strong><p>۳۹۶ دسته‌بندی · ۱۸۲ پاسخ پیشنهادی</p><small>محدودیت کانتکست فعال است</small></article>
        <article className="panel usage-card"><span className="eyebrow">Firecrawl</span><strong>۰٫۴۵ دلار</strong><p>۳۱ بررسی انتخابی</p><small>۸٫۴٪ پاسخ‌ها غنی‌سازی شده‌اند</small></article>
      </div>
      <article className="panel alert-policy"><div className="panel-head"><div><span className="eyebrow">محافظ‌های خودکار</span><h3>قوانین هشدار بودجه</h3></div><span className="live-pill"><i/> فعال</span></div><div className="policy-row"><span className="policy-level warning">۵۰٪</span><div><strong>هشدار اولیه در ۵ دلار</strong><small>اعلان به تلگرام و اپراتورهای داشبورد</small></div><b>هنوز نرسیده</b></div><div className="policy-row"><span className="policy-level critical">۸۰٪</span><div><strong>هشدار بحرانی در ۸ دلار</strong><small>توقف Firecrawl خودکار و افزایش فاصله پایش</small></div><b>هنوز نرسیده</b></div><div className="policy-row"><span className="policy-level stop">۱۰۰٪</span><div><strong>توقف کامل در ۱۰ دلار</strong><small>خواندن پولی متوقف می‌شود؛ داشبورد در دسترس می‌ماند.</small></div><b>محافظت‌شده</b></div></article>
    </section>
  );
}

function SettingsView() {
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return SETTINGS_DEFAULTS;
    try {
      const stored = JSON.parse(window.localStorage.getItem("wallet-social-settings") || "null");
      return stored && typeof stored === "object" ? { ...SETTINGS_DEFAULTS, ...stored } : SETTINGS_DEFAULTS;
    } catch {
      return SETTINGS_DEFAULTS;
    }
  });
  const [saved, setSaved] = useState(false);
  const saveSettings = () => {
    window.localStorage.setItem("wallet-social-settings", JSON.stringify(settings));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };
  return <section>
    <div className="settings-grid">
      <article className="panel settings-card"><div className="panel-head"><div><span className="eyebrow">اتصال به X</span><h3>پایش Owned Reads</h3></div><button className={`switch ${settings.polling ? "on" : ""}`} onClick={() => setSettings({ ...settings, polling: !settings.polling })} aria-label="فعال یا غیرفعال‌کردن پایش" aria-pressed={settings.polling}><i/></button></div><div className="x-account-card"><span className="avatar">WT</span><div><small>اکانت رسمی پروژه</small><strong dir="ltr">{X_ACCOUNT_HANDLE}</strong></div><a href={X_ACCOUNT_URL} target="_blank" rel="noreferrer">مشاهده در X ↗</a></div><label>فاصله زمانی پایش<select value={settings.interval} onChange={(event) => setSettings({ ...settings, interval: event.target.value })}><option value="120">هر ۲ دقیقه</option><option value="300">هر ۵ دقیقه</option></select></label><label>سقف قطعی ماهانه<div className="input-prefix"><span>$</span><input inputMode="decimal" value={settings.budget} onChange={(event) => setSettings({ ...settings, budget: event.target.value })}/></div></label><div className="settings-note">سامانه مقدار <code>since_id</code> را ذخیره می‌کند و هیچ پاسخ را عمداً دوبار دریافت نمی‌کند.</div></article>
      <article className="panel settings-card"><div className="panel-head"><div><span className="eyebrow">قوانین کانتکست</span><h3>غنی‌سازی با Firecrawl</h3></div><button className={`switch ${settings.firecrawl ? "on" : ""}`} onClick={() => setSettings({ ...settings, firecrawl: !settings.firecrawl })} aria-label="فعال یا غیرفعال‌کردن Firecrawl" aria-pressed={settings.firecrawl}><i/></button></div><label className="check-row"><input type="checkbox" checked={settings.lowConfidence} onChange={(event) => setSettings({ ...settings, lowConfidence: event.target.checked })}/><span><strong>پاسخ‌های کم‌اطمینان</strong><small>اطمینان کمتر از ۸۲٪</small></span></label><label className="check-row"><input type="checkbox" checked={settings.externalClaims} onChange={(event) => setSettings({ ...settings, externalClaims: event.target.checked })}/><span><strong>لینک‌ها و ادعاهای خارجی</strong><small>بررسی آدرس‌ها و اطلاعات عمومی روز</small></span></label><label className="check-row"><input type="checkbox" checked={settings.importantAccounts} onChange={(event) => setSettings({ ...settings, importantAccounts: event.target.checked })}/><span><strong>حساب‌های عمومی مهم</strong><small>افزودن پروفایل عمومی و سابقه گفتگو</small></span></label></article>
    </div>
    <div className="settings-savebar"><div><strong>تغییرات تنظیمات</strong><span>پس از بررسی مقادیر، تنظیمات را برای این میز اپراتور ذخیره کنید.</span></div><button className={`btn accent ${saved ? "done" : ""}`} type="button" onClick={saveSettings}>{saved ? "✓ تنظیمات ذخیره شد" : "ذخیره تنظیمات"}</button></div>
    {saved && <div className="toast">✓ تنظیمات با موفقیت ذخیره شد</div>}
  </section>;
}

export default function DashboardClient() {
  const [view, setView] = useState<View>("overview");
  const [targetView, setTargetView] = useState<View>("overview");
  const [seconds, setSeconds] = useState(78);
  const [mobileNav, setMobileNav] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "leaving" | "loading">("idle");
  const transitionTimers = useRef<number[]>([]);
  const sentReplies = useStoredIds("wallet-social-sent-replies");
  const sentPosts = useStoredIds("wallet-social-sent-posts");
  const managedReplies = useStoredCollection<ReplyItem>("wallet-social-reply-items", replies);
  const managedContent = useStoredCollection<ContentItem>("wallet-social-content-items", contentItems);

  useEffect(() => {
    const initialView = viewFromPathname(window.location.pathname);
    const canonicalPath = viewRoutes[initialView];
    const routeInitTimer = window.setTimeout(() => {
      setView(initialView);
      setTargetView(initialView);
    }, 0);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({ view: initialView }, "", canonicalPath);
    } else {
      window.history.replaceState({ view: initialView }, "", window.location.href);
    }

    const handlePopState = () => {
      const next = viewFromPathname(window.location.pathname);
      transitionTimers.current.forEach((item) => window.clearTimeout(item));
      setMobileNav(false);
      setTargetView(next);
      setTransitionPhase("leaving");
      transitionTimers.current = [
        window.setTimeout(() => {
          setView(next);
          setTransitionPhase("loading");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 170),
        window.setTimeout(() => setTransitionPhase("idle"), 620),
      ];
    };

    const timer = window.setInterval(() => setSeconds((value) => value <= 0 ? 119 : value - 1), 1000);
    const loadingTimer = window.setTimeout(() => setIsLoading(false), 950);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.clearTimeout(routeInitTimer);
      window.clearInterval(timer);
      window.clearTimeout(loadingTimer);
      transitionTimers.current.forEach((item) => window.clearTimeout(item));
    };
  }, []);

  useEffect(() => {
    document.title = `${viewMeta[view].title} | والت سوشال`;
  }, [view]);

  const changeView = (next: View) => {
    setMobileNav(false);
    const nextPath = viewRoutes[next];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ view: next }, "", nextPath);
    }
    if (next === targetView && transitionPhase === "idle") return;
    transitionTimers.current.forEach((item) => window.clearTimeout(item));
    setTargetView(next);
    setTransitionPhase("leaving");
    transitionTimers.current = [
      window.setTimeout(() => {
        setView(next);
        setTransitionPhase("loading");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 170),
      window.setTimeout(() => setTransitionPhase("idle"), 620),
    ];
  };
  const refreshView = () => {
    transitionTimers.current.forEach((item) => window.clearTimeout(item));
    setTransitionPhase("leaving");
    transitionTimers.current = [
      window.setTimeout(() => setTransitionPhase("loading"), 170),
      window.setTimeout(() => setTransitionPhase("idle"), 670),
    ];
  };
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark" aria-hidden="true"><strong>WT</strong></div><div><strong>والت سوشال</strong><small>مرکز مدیریت شبکه اجتماعی</small></div></div>
        <nav className="navigation">
          {navGroups.map((group) => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map((item) => <button key={item.id} className={`nav-link ${targetView === item.id ? "active" : ""} ${transitionPhase !== "idle" && targetView === item.id ? "pending" : ""}`} onClick={() => changeView(item.id)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>)}</div>)}
        </nav>
        <div className="automation-card"><div className="automation-head"><span className="eyebrow">موتور پایش</span><i className="status-dot"/></div><strong>در حال بررسی <span dir="ltr">{X_ACCOUNT_HANDLE}</span></strong><p>بررسی بعدی Owned Reads تا <b>{time}</b> دیگر انجام می‌شود. پاسخ‌های جدید مستقیماً وارد بررسی انسانی می‌شوند.</p><button className="btn accent full" onClick={() => changeView("replies")}>بررسی پاسخ‌های منتظر ←</button></div>
        <div className="sidebar-footer"><span><i className="mini-dot cyan"/> X API</span><span><i className="mini-dot violet"/> هوش مصنوعی</span><span><i className="mini-dot amber"/> Firecrawl</span></div>
      </aside>

      {mobileNav && <button className="nav-overlay" onClick={() => setMobileNav(false)} aria-label="بستن منو"/>}

      <main className="main">
        <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileNav(true)} aria-label="بازکردن منو">☰</button><div className="view-heading" key={view}><div className="title-line"><h1>{viewMeta[view].title}</h1><span className="system-pill"><i/> سیستم سالم است</span></div><p>{viewMeta[view].sub}</p></div></div><div className="topbar-actions"><span className="clock-chip">تهران · ۱۴:۳۲</span><button className={`btn quiet refresh-button ${transitionPhase !== "idle" ? "spinning" : ""}`} onClick={refreshView}><span aria-hidden="true">↻</span> تازه‌سازی</button><button className="logout-button" onClick={() => void logout()} disabled={loggingOut} aria-label="خروج از داشبورد"><span aria-hidden="true">↪</span><b>{loggingOut ? "در حال خروج" : "خروج"}</b></button><span className="operator"><i>ش</i><span><strong>میز اپراتور</strong><small>بررسی انسانی فعال</small></span></span></div></header>
        <div className={`content content-stage ${transitionPhase === "leaving" ? "is-leaving" : ""}`} aria-busy={isLoading || transitionPhase !== "idle"}>
          {(isLoading || transitionPhase === "loading") ? <ViewSkeleton /> : <div className="view-enter" key={view}>
            {view === "overview" && <Overview onNavigate={changeView}/>} 
            {view === "replies" && <RepliesView replyItems={managedReplies.items} onRepliesChange={managedReplies.setItems} sentIds={sentReplies.ids} onMarkSent={sentReplies.mark}/>}
            {view === "content" && <ContentView content={managedContent.items} onContentChange={managedContent.setItems} sentIds={sentPosts.ids} onMarkSent={sentPosts.mark}/>}
            {view === "sent" && <SentView replyIds={sentReplies.ids} postIds={sentPosts.ids} replyItems={managedReplies.items} content={managedContent.items}/>}
            {view === "telegram" && <TelegramView onNavigate={changeView}/>}
            {view === "research" && <ResearchView/>}
            {view === "budget" && <BudgetView/>}
            {view === "settings" && <SettingsView/>}
          </div>}
        </div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="دسترسی سریع موبایل">
        {[{ id: "overview" as View, icon: "⌂", label: "خانه" }, { id: "replies" as View, icon: "↩", label: "پاسخ‌ها" }, { id: "content" as View, icon: "≡", label: "محتوا" }, { id: "telegram" as View, icon: "➤", label: "تلگرام" }].map((item) => <button key={item.id} className={`${targetView === item.id ? "active" : ""} ${transitionPhase !== "idle" && targetView === item.id ? "pending" : ""}`} onClick={() => changeView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}
      </nav>
    </div>
  );
}
