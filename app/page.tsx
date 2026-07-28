"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type View = "overview" | "replies" | "content" | "sent" | "telegram" | "research" | "budget" | "settings";
type Risk = "green" | "yellow" | "red";
type TelegramConnection = {
  configured: boolean;
  connected: boolean;
  bot?: { name: string; username: string };
  group?: { id: string; title: string; type: string } | null;
  error?: string;
};

const X_ACCOUNT_HANDLE = "@WalletTrackerHQ";
const X_ACCOUNT_URL = "https://x.com/WalletTrackerHQ";

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

const replies = [
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

const contentItems = [
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

function useStoredIds(key: string) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setIds(JSON.parse(window.localStorage.getItem(key) || "[]")); } catch { setIds([]); }
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready) window.localStorage.setItem(key, JSON.stringify(ids)); }, [ids, key, ready]);
  const mark = (id: string) => setIds((current) => current.includes(id) ? current : [...current, id]);
  return { ids, mark };
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

function RepliesView({ sentIds, onMarkSent }: { sentIds: string[]; onMarkSent: (id: string) => void }) {
  const [selected, setSelected] = useState(0);
  const [toast, setToast] = useState("");
  const reply = replies[selected];
  const isSent = sentIds.includes(reply.id);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const copyAnswer = async () => {
    await navigator.clipboard?.writeText(reply.answer);
    notify("پاسخ کپی شد؛ حالا آن را در X ارسال کنید");
  };

  return (
    <section className="inbox-layout">
      <article className="panel inbox-list-panel">
        <div className="panel-head inbox-head"><div><span className="eyebrow">۱۲ مورد منتظر</span><h3>پاسخ‌های دریافتی</h3></div><button className="filter-btn">همه زبان‌ها⌄</button></div>
        <label className="search-box"><span>⌕</span><input placeholder="جست‌وجوی پاسخ یا نام کاربر…" /></label>
        <div className="inbox-list">
          {replies.map((item, index) => (
            <button key={item.id} className={`inbox-item ${selected === index ? "active" : ""} ${sentIds.includes(item.id) ? "handled" : ""}`} onClick={() => setSelected(index)}>
              <span className="avatar">{item.avatar}</span>
              <span><strong>{item.handle}</strong><small>{item.original}</small><em>{item.language} · {item.age}</em></span>
              {sentIds.includes(item.id) ? <span className="sent-chip">ارسال‌شده</span> : <RiskBadge risk={item.risk} />}
            </button>
          ))}
        </div>
      </article>

      <article className="panel conversation-panel">
        <div className="conversation-motion" key={reply.id}>
        <div className="conversation-head">
              <div className="identity"><span className="avatar large">{reply.avatar}</span><div><strong>{reply.handle}</strong><small>{reply.language} · {reply.sentiment} · {reply.age} قبل</small></div></div>
          <div><RiskBadge risk={reply.risk} /><button className="icon-button" aria-label="اقدام‌های بیشتر">•••</button></div>
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
            <button className="btn quiet">ویرایش پاسخ</button>
            <button className="btn quiet">ارجاع به مدیر</button>
            <button className="btn accent" onClick={copyAnswer}>کپی پاسخ</button>
            <button className="btn primary" onClick={() => window.open("https://x.com/", "_blank", "noopener,noreferrer")}>بازکردن گفتگو در X ↗</button>
            <button className={`btn sent-action ${isSent ? "done" : ""}`} disabled={isSent} onClick={() => { onMarkSent(reply.id); notify("پاسخ به‌عنوان ارسال‌شده ثبت شد"); }}>{isSent ? "✓ پاسخ ارسال شده است" : "من این پاسخ را ارسال کردم"}</button>
          </div>
        </div>
        </div>
      </article>
      {toast && <div className="toast">✓ {toast}</div>}
    </section>
  );
}

function ContentView({ sentIds, onMarkSent }: { sentIds: string[]; onMarkSent: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | Risk>("all");
  const [status, setStatus] = useState<"all" | "ready" | "sent">("all");
  const [toast, setToast] = useState("");
  const items = useMemo(() => contentItems.filter((item) => filter === "all" || item.risk === filter), [filter]);
  const visibleItems = items.filter((item) => status === "all" || (status === "sent") === sentIds.includes(item.id));
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  const copyPost = async (text: string) => { await navigator.clipboard?.writeText(text); notify("متن پست کپی شد؛ آن را در X منتشر کنید"); };
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
        <button className="btn accent">＋ پیش‌نویس جدید</button>
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
            <div className="card-actions"><button className="btn quiet">ویرایش</button><button className="btn accent" onClick={() => copyPost(item.postText)}>کپی متن</button><button className="btn primary" onClick={() => window.open("https://x.com/compose/post", "_blank", "noopener,noreferrer")}>بازکردن X ↗</button><button className={`btn sent-action ${isSent ? "done" : ""}`} disabled={isSent} onClick={() => { onMarkSent(item.id); notify("پست به‌عنوان منتشرشده ثبت شد"); }}>{isSent ? "✓ انتشار ثبت شد" : "من این پست را منتشر کردم"}</button></div>
          </article>;
        })}
      </div>
      {visibleItems.length === 0 && <div className="panel empty-state"><strong>موردی با این فیلتر پیدا نشد.</strong><p>فیلتر وضعیت یا ریسک را تغییر دهید.</p></div>}
      {toast && <div className="toast">✓ {toast}</div>}
    </section>
  );
}

function SentView({ replyIds, postIds }: { replyIds: string[]; postIds: string[] }) {
  const records = [
    ...contentItems.filter((item) => postIds.includes(item.id)).map((item) => ({ id: item.id, type: "پست", title: item.title, detail: item.postText, language: item.language })),
    ...replies.filter((item) => replyIds.includes(item.id)).map((item) => ({ id: item.id, type: "پاسخ", title: `پاسخ به ${item.handle}`, detail: item.answer, language: item.language })),
  ];
  return <section>
    <div className="history-summary">
      <article className="panel"><span>ثبت‌شده امروز</span><strong>{records.length}</strong><small>توسط میز اپراتور</small></article>
      <article className="panel"><span>پست منتشرشده</span><strong>{postIds.length}</strong><small>دارای تأیید انسانی</small></article>
      <article className="panel"><span>پاسخ ارسال‌شده</span><strong>{replyIds.length}</strong><small>با زبان اصلی کاربر</small></article>
    </div>
    <article className="panel history-panel">
      <div className="panel-head"><div><span className="eyebrow">گزارش عملیات</span><h3>ارسال‌های تأییدشده اپراتور</h3><p>در نسخه نهایی، زمان دقیق، کاربر انجام‌دهنده و لینک X در Audit Log ثبت می‌شود.</p></div></div>
      {records.length === 0 ? <div className="empty-state"><strong>هنوز ارسالی ثبت نشده است.</strong><p>پس از انتشار در X، دکمه «من ارسال کردم» را در صف محتوا یا صندوق پاسخ‌ها بزنید.</p></div> : <div className="history-list">{records.map((record, index) => <div className="history-row" key={record.id}><span className={`history-icon ${record.type === "پست" ? "post" : "reply"}`}>{record.type === "پست" ? "≡" : "↩"}</span><div><strong>{record.title}</strong><p dir="auto">{record.detail}</p><small>{record.language} · میز اپراتور · همین حالا</small></div><span className="sent-chip">✓ ثبت‌شده</span><button className="btn quiet" onClick={() => window.open("https://x.com/", "_blank", "noopener,noreferrer")}>دیدن در X ↗</button></div>)}</div>}
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

  useEffect(() => { void refreshConnection(); }, []);

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
  return (
    <section className="research-grid">
      <article className="panel research-hero"><span className="eyebrow">بررسی انتخابی</span><h2>Firecrawl فقط وقتی اجرا می‌شود که کانتکست ارزش هزینه را داشته باشد.</h2><p>هر سیگنال از نظر ارتباط، تازگی و اعتبار منبع امتیاز می‌گیرد و سپس وارد صف محتوا می‌شود.</p><button className="btn accent">اجرای پژوهش هدفمند</button></article>
      {[{score:92,title:"پرسش‌های امنیت کیف‌پول در حال افزایش است",meta:"۱۸ پست X · ۷ منبع · انگلیسی و اسپانیایی",tag:"فرصت محتوایی"},{score:86,title:"اعتمادپذیری اعلان‌های سولانا یک دغدغه پرتکرار است",meta:"۱۱ گفتگو · ۵ منبع · ۱۲ ساعت",tag:"آموزش محصول"},{score:74,title:"یکی از رقبا پشتیبانی از Base را اضافه کرد",meta:"نسخه تأیید شد · ۳ منشن پشتیبان",tag:"سیگنال رقابتی"}].map((item) => <article className="panel research-card" key={item.title}><div className="score">{item.score}</div><div><span>{item.tag}</span><h3>{item.title}</h3><p>{item.meta}</p></div><button className="text-btn">بررسی شواهد ←</button></article>)}
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
  const [polling, setPolling] = useState(true);
  const [firecrawl, setFirecrawl] = useState(true);
  return <section className="settings-grid"><article className="panel settings-card"><div className="panel-head"><div><span className="eyebrow">اتصال به X</span><h3>پایش Owned Reads</h3></div><button className={`switch ${polling ? "on" : ""}`} onClick={() => setPolling(!polling)} aria-label="فعال یا غیرفعال‌کردن پایش"><i/></button></div><div className="x-account-card"><span className="avatar">WT</span><div><small>اکانت رسمی پروژه</small><strong dir="ltr">{X_ACCOUNT_HANDLE}</strong></div><a href={X_ACCOUNT_URL} target="_blank" rel="noreferrer">مشاهده در X ↗</a></div><label>فاصله زمانی پایش<select defaultValue="120"><option value="120">هر ۲ دقیقه</option><option value="300">هر ۵ دقیقه</option></select></label><label>سقف قطعی ماهانه<div className="input-prefix"><span>$</span><input defaultValue="10.00"/></div></label><div className="settings-note">سامانه مقدار <code>since_id</code> را ذخیره می‌کند و هیچ پاسخ را عمداً دوبار دریافت نمی‌کند.</div></article><article className="panel settings-card"><div className="panel-head"><div><span className="eyebrow">قوانین کانتکست</span><h3>غنی‌سازی با Firecrawl</h3></div><button className={`switch ${firecrawl ? "on" : ""}`} onClick={() => setFirecrawl(!firecrawl)} aria-label="فعال یا غیرفعال‌کردن Firecrawl"><i/></button></div><label className="check-row"><input type="checkbox" defaultChecked/><span><strong>پاسخ‌های کم‌اطمینان</strong><small>اطمینان کمتر از ۸۲٪</small></span></label><label className="check-row"><input type="checkbox" defaultChecked/><span><strong>لینک‌ها و ادعاهای خارجی</strong><small>بررسی آدرس‌ها و اطلاعات عمومی روز</small></span></label><label className="check-row"><input type="checkbox" defaultChecked/><span><strong>حساب‌های عمومی مهم</strong><small>افزودن پروفایل عمومی و سابقه گفتگو</small></span></label></article></section>;
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [targetView, setTargetView] = useState<View>("overview");
  const [seconds, setSeconds] = useState(78);
  const [mobileNav, setMobileNav] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "leaving" | "loading">("idle");
  const transitionTimers = useRef<number[]>([]);
  const sentReplies = useStoredIds("wallet-social-sent-replies");
  const sentPosts = useStoredIds("wallet-social-sent-posts");

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value <= 0 ? 119 : value - 1), 1000);
    const loadingTimer = window.setTimeout(() => setIsLoading(false), 950);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(loadingTimer);
      transitionTimers.current.forEach((item) => window.clearTimeout(item));
    };
  }, []);

  const changeView = (next: View) => {
    setMobileNav(false);
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

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark" aria-hidden="true"><span/><span/><span/><span/></div><div><strong>والت سوشال</strong><small>مرکز مدیریت شبکه اجتماعی</small></div></div>
        <nav className="navigation">
          {navGroups.map((group) => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map((item) => <button key={item.id} className={`nav-link ${targetView === item.id ? "active" : ""} ${transitionPhase !== "idle" && targetView === item.id ? "pending" : ""}`} onClick={() => changeView(item.id)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>)}</div>)}
        </nav>
        <div className="automation-card"><div className="automation-head"><span className="eyebrow">موتور پایش</span><i className="status-dot"/></div><strong>در حال بررسی <span dir="ltr">{X_ACCOUNT_HANDLE}</span></strong><p>بررسی بعدی Owned Reads تا <b>{time}</b> دیگر انجام می‌شود. پاسخ‌های جدید مستقیماً وارد بررسی انسانی می‌شوند.</p><button className="btn accent full" onClick={() => changeView("replies")}>بررسی پاسخ‌های منتظر ←</button></div>
        <div className="sidebar-footer"><span><i className="mini-dot cyan"/> X API</span><span><i className="mini-dot violet"/> هوش مصنوعی</span><span><i className="mini-dot amber"/> Firecrawl</span></div>
      </aside>

      {mobileNav && <button className="nav-overlay" onClick={() => setMobileNav(false)} aria-label="بستن منو"/>}

      <main className="main">
        <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileNav(true)} aria-label="بازکردن منو">☰</button><div className="view-heading" key={view}><div className="title-line"><h1>{viewMeta[view].title}</h1><span className="system-pill"><i/> سیستم سالم است</span></div><p>{viewMeta[view].sub}</p></div></div><div className="topbar-actions"><span className="clock-chip">تهران · ۱۴:۳۲</span><button className={`btn quiet refresh-button ${transitionPhase !== "idle" ? "spinning" : ""}`} onClick={refreshView}><span aria-hidden="true">↻</span> تازه‌سازی</button><span className="operator"><i>ش</i><span><strong>میز اپراتور</strong><small>بررسی انسانی فعال</small></span></span></div></header>
        <div className={`content content-stage ${transitionPhase === "leaving" ? "is-leaving" : ""}`} aria-busy={isLoading || transitionPhase !== "idle"}>
          {(isLoading || transitionPhase === "loading") ? <ViewSkeleton /> : <div className="view-enter" key={view}>
            {view === "overview" && <Overview onNavigate={changeView}/>} 
            {view === "replies" && <RepliesView sentIds={sentReplies.ids} onMarkSent={sentReplies.mark}/>}
            {view === "content" && <ContentView sentIds={sentPosts.ids} onMarkSent={sentPosts.mark}/>}
            {view === "sent" && <SentView replyIds={sentReplies.ids} postIds={sentPosts.ids}/>}
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
