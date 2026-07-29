"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { DailyManagerPlan } from "@/lib/social-manager-types";

type View = "overview" | "strategy" | "tasks" | "creative" | "growth" | "replies" | "content" | "sent" | "telegram" | "research" | "budget" | "settings";
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
  imageUrl?: string;
  imageError?: string;
  sourceUrls?: string[];
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
type XConnection = {
  configured: boolean;
  connected: boolean;
  handle?: string;
  needsCredit?: boolean;
  code?: string;
  error?: string;
  account?: { id: string; name: string; username: string; profile_image_url?: string; public_metrics?: { followers_count?: number; tweet_count?: number } };
};

const X_ACCOUNT_HANDLE = "@wallettrackerH";
const X_ACCOUNT_URL = "https://x.com/wallettrackerH";
const SETTINGS_DEFAULTS = { polling: true, firecrawl: true, interval: "120", budget: "5.00", lowConfidence: true, externalClaims: true, importantAccounts: true };

const navGroups = [
  {
    label: "کارهای اپراتور · از بالا به پایین",
    items: [
      { id: "overview" as View, icon: "⌂", label: "امروز چه‌کار کنم؟" },
      { id: "content" as View, icon: "۱", label: "پست آماده" },
      { id: "replies" as View, icon: "۲", label: "پاسخ‌های آماده" },
      { id: "tasks" as View, icon: "۳", label: "لیست کار امروز" },
      { id: "sent" as View, icon: "✓", label: "کارهای انجام‌شده" },
    ],
  },
  {
    label: "ابزارهای مدیر · اپراتور نیاز ندارد",
    collapsible: true,
    items: [
      { id: "strategy" as View, icon: "◫", label: "برنامه هفتگی" },
      { id: "creative" as View, icon: "✦", label: "ساخت محتوای جدید" },
      { id: "growth" as View, icon: "↗", label: "برنامه رشد" },
      { id: "telegram" as View, icon: "➤", label: "تنظیم اعلان‌ها" },
      { id: "research" as View, icon: "◇", label: "تحقیق زنده" },
      { id: "budget" as View, icon: "▥", label: "اعتبار ۵ دلاری X" },
      { id: "settings" as View, icon: "⚙", label: "تنظیمات فنی" },
    ],
  },
];

const viewMeta: Record<View, { title: string; sub: string }> = {
  overview: { title: "کارهای امروز", sub: "فقط از مرحله ۱ شروع کنید و دکمه نارنجی را بزنید." },
  strategy: { title: "استراتژی و تقویم", sub: "پلن ماهانه، موضوع‌های هفتگی و زمان دقیق اجرای روزانه" },
  tasks: { title: "لیست کار امروز", sub: "هر کار را انجام دهید، سپس تیک همان ردیف را بزنید." },
  creative: { title: "استودیوی محتوا", sub: "ساخت بسته یکپارچه متن، ترجمه، تصویر و زمان انتشار" },
  growth: { title: "رشد و تعامل", sub: "اکانت‌ها، گفتگوها و پاسخ‌های هدفمند با کنترل ضداسپم" },
  replies: { title: "صندوق پاسخ‌ها", sub: "پاسخ‌های چندزبانه را پیش از ارسال توسط اپراتور بررسی کنید." },
  content: { title: "صف محتوا", sub: "پست‌های پیشنهادی را از یک محل بررسی، ویرایش و زمان‌بندی کنید." },
  sent: { title: "تاریخچه ارسال", sub: "همه پست‌ها و پاسخ‌هایی که اپراتور انتشار آن‌ها را تأیید کرده است." },
  telegram: { title: "اعلان‌های تلگرام", sub: "هشدارها، لینک‌های مستقیم و قوانین اطلاع‌رسانی گروه اپراتورها" },
  research: { title: "پژوهش زنده", sub: "سیگنال‌های منتخب Firecrawl برای تصمیم‌گیری محتوایی" },
  budget: { title: "اعتبار X برای خواندن کامنت‌ها", sub: "تمام ۵ دلار فقط برای Owned Reads منشن‌های اکانت اصلی رزرو شده است." },
  settings: { title: "تنظیمات", sub: "فاصله پایش، قوانین تأیید و محدودیت‌های هزینه را مدیریت کنید." },
};

const viewRoutes: Record<View, string> = {
  overview: "/",
  strategy: "/strategy",
  tasks: "/tasks",
  creative: "/creative",
  growth: "/growth",
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
  "/strategy": "strategy",
  "/tasks": "tasks",
  "/creative": "creative",
  "/growth": "growth",
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

const replies: ReplyItem[] = [];

const contentItems: ContentItem[] = [];

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

function useDailyManagerPlan() {
  const [plan, setPlan] = useState<DailyManagerPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("در حال بررسی برنامه ذخیره‌شده امروز…");
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const imageRequests = useRef(new Set<string>());

  const generateImages = useCallback(async (dailyPlan: DailyManagerPlan, force = false) => {
    const storageKey = `wallet-social-manager-images-${dailyPlan.date}`;
    let stored: Record<string, string> = {};
    try { stored = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { stored = {}; }
    if (Object.keys(stored).length) setPlan((current) => current ? { ...current, posts: current.posts.map((post) => ({ ...post, imageUrl: stored[post.id] || post.imageUrl })) } : current);
    for (const post of dailyPlan.posts) {
      if ((!force && stored[post.id]) || imageRequests.current.has(post.id)) continue;
      if (force) delete stored[post.id];
      imageRequests.current.add(post.id);
      try {
        setImageErrors((current) => { const next = { ...current }; delete next[post.id]; return next; });
        setStage(`در حال ساخت تصویر اختصاصی «${post.title}»…`);
        const response = await fetch("/api/manager/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: post.imagePrompt }) });
        const payload = await response.json() as { ok?: boolean; imageUrl?: string; error?: string };
        if (!response.ok || !payload.ok || !payload.imageUrl) throw new Error(payload.error || `تولید تصویر ناموفق بود (${response.status}).`);
        stored[post.id] = payload.imageUrl;
        setPlan((current) => current ? { ...current, posts: current.posts.map((item) => item.id === post.id ? { ...item, imageUrl: payload.imageUrl } : item) } : current);
        try { localStorage.setItem(storageKey, JSON.stringify(stored)); } catch { /* The in-memory image remains usable if browser storage is full. */ }
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "تولید تصویر ناموفق بود.";
        setImageErrors((current) => ({ ...current, [post.id]: message }));
      } finally {
        imageRequests.current.delete(post.id);
      }
    }
    setStage("برنامه زنده امروز آماده اجراست");
  }, []);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    setStage(force ? "در حال جمع‌آوری دوباره داده‌های زنده X و وب…" : "در حال دریافت برنامه هوشمند امروز…");
    try {
      let response = await fetch("/api/manager/daily-plan", { cache: "no-store" });
      if (response.status === 404 || force) {
        setStage("Firecrawl در حال بررسی X، اخبار و منابع محصول است…");
        response = await fetch("/api/manager/daily-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ force }) });
      }
      const payload = await response.json() as { ok?: boolean; plan?: DailyManagerPlan; error?: string };
      if (!response.ok || !payload.ok || !payload.plan) throw new Error(payload.error || "برنامه امروز دریافت نشد.");
      setPlan(payload.plan);
      setStage("برنامه زنده آماده شد؛ تصاویر در حال تکمیل‌اند…");
      void generateImages(payload.plan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "دریافت برنامه زنده ناموفق بود.");
      setStage("برنامه زنده در دسترس نیست");
    } finally {
      setLoading(false);
    }
  }, [generateImages]);

  useEffect(() => { const timer = window.setTimeout(() => void load(false), 0); return () => window.clearTimeout(timer); }, [load]);
  return { plan, loading, error, stage, imageErrors, regenerate: () => load(true), retryImages: () => plan ? generateImages(plan, true) : Promise.resolve() };
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

function ImageLightbox({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, []);
  return createPortal(
    <div className="image-lightbox" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <figure role="dialog" aria-modal="true" aria-label={`نمایش بزرگ ${title}`}>
        <button ref={closeButton} className="image-lightbox-close" type="button" onClick={onClose} aria-label="بستن تصویر بزرگ">×</button>
        <Image src={src} alt={`نمایش بزرگ ${title}`} width={1600} height={900} unoptimized priority />
        <figcaption><span>{title}</span><small>برای بستن، بیرون تصویر کلیک کنید یا کلید Esc را بزنید.</small></figcaption>
      </figure>
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

function Overview({ onNavigate, manager }: { onNavigate: (view: View) => void; manager: ReturnType<typeof useDailyManagerPlan> }) {
  const { plan, loading, error, stage, regenerate } = manager;
  return (
    <section className="operator-home">
      <div className="operator-welcome panel">
        <div><span className="eyebrow">مدیر هوشمند روزانه · داده زنده</span><h2>{plan?.headline || "در حال ساخت برنامه واقعی امروز…"}</h2><p>{plan?.strategy || "Firecrawl گفتگوهای عمومی X، خبرها و منابع محصول را بررسی می‌کند؛ سپس برنامه قدم‌به‌قدم ساخته می‌شود."}</p></div>
        <div className="today-clock"><span>{plan ? "هدف امروز" : "وضعیت"}</span><strong>{plan?.publishDecision === "pause" ? "توقف انتشار" : plan ? `${plan.tasks.length.toLocaleString("fa-IR")} کار` : "در حال تحلیل"}</strong><small>{plan?.todayGoal || stage}</small></div>
      </div>

      <div className={`manager-live-strip panel ${error ? "has-error" : ""}`}><div><i className="status-dot"/><span><strong>{stage}</strong><small>{plan ? `آخرین تحلیل: ${new Date(plan.generatedAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })} · ${plan.sources.length.toLocaleString("fa-IR")} منبع زنده` : error || "این فرایند در اولین ورود هر روز خودکار اجرا می‌شود."}</small></span></div><button className="btn quiet" disabled={loading} onClick={() => void regenerate()}>{loading ? "در حال ساخت…" : "بازسازی با داده تازه ↻"}</button></div>

      {plan && <article className={`publish-decision panel ${plan.publishDecision}`}><span>{plan.publishDecision === "publish" ? "امروز منتشر می‌کنیم" : plan.publishDecision === "light" ? "امروز سبک منتشر می‌کنیم" : "امروز پست تازه نمی‌گذاریم"}</span><strong>{plan.publishReason}</strong></article>}

      {plan && <div className="simple-status panel"><div><i className="status-dot"/><span><strong>وضعیت عمومی اکانت بررسی شد</strong><small>{plan.sources.filter((source) => source.channel === "account").length.toLocaleString("fa-IR")} منبع از پروفایل و پست‌های عمومی اکانت با Firecrawl</small></span></div><div><i className="budget-lock">✓</i><span><strong>دانش واقعی پروژه وارد تصمیم شد</strong><small>{plan.sources.filter((source) => source.channel === "project" || source.channel === "product").length.toLocaleString("fa-IR")} منبع اول‌شخص از مخزن و وب‌سایت محصول</small></span></div><div><i className="telegram-dot">◇</i><span><strong>بازار و گفتگوهای مرتبط رصد شدند</strong><small>{plan.sources.filter((source) => ["x", "news", "competitor"].includes(source.channel)).length.toLocaleString("fa-IR")} منبع تازه از X، خبر و رقبا؛ بدون مصرف اعتبار X API</small></span></div></div>}

      <div className="operator-journey">
        {(plan?.tasks.slice(0, 3) || []).map((task, index) => <article className={`operator-step panel lift-card ${index === 0 ? "current" : ""}`} key={task.id}><span className="step-number">{(index + 1).toLocaleString("fa-IR")}</span><div className="step-copy"><small>{task.time} · {task.priority === "now" ? "الان انجام بده" : "امروز انجام بده"}</small><h3>{task.title}</h3><p>{task.instruction}</p><div className={task.risk === "green" ? "step-safe" : "step-warning"}>{task.why}</div></div><button className={index === 0 ? "btn accent" : "btn quiet"} onClick={() => onNavigate(task.kind === "publish" ? "content" : task.kind === "reply" ? "replies" : task.kind === "interact" ? "growth" : "tasks")}>رفتن به بخش ←</button></article>)}
        {!plan && <article className="operator-step panel live-plan-loading"><span className="button-spinner"/><div><h3>{error ? "برنامه زنده ساخته نشد" : "مدیر هوشمند در حال کار است"}</h3><p>{error || "کمی صبر کنید؛ وظایف ساختگی نمایش داده نمی‌شوند."}</p></div></article>}
      </div>

      <div className="simple-status panel">
        <div><i className="status-dot"/><span><strong>کامنت‌ها هر ۲ دقیقه بررسی می‌شوند</strong><small>کامنت جدید خودکار وارد صندوق پاسخ‌ها می‌شود.</small></span></div>
        <div><i className="budget-lock">$</i><span><strong>۵ دلار فقط برای خواندن کامنت‌ها</strong><small>هزینه هر منشن جدید: ۰٫۰۰۱ دلار؛ جست‌وجو و انتشار از این اعتبار استفاده نمی‌کند.</small></span></div>
        <div><i className="telegram-dot">➤</i><span><strong>تلگرام به اپراتور خبر می‌دهد</strong><small>برای هر کار آماده، لینک مستقیم همین صفحه ارسال می‌شود.</small></span></div>
      </div>

      <details className="manager-shortcuts panel"><summary>ابزارهای مدیر را نشان بده <small>اپراتور معمولاً به این قسمت نیاز ندارد</small></summary><div>{[["strategy","برنامه هفتگی"],["creative","ساخت محتوای جدید"],["growth","برنامه رشد"],["budget","کنترل اعتبار X"],["settings","تنظیمات فنی"]].map(([target,label]) => <button className="btn quiet" key={target} onClick={() => onNavigate(target as View)}>{label}</button>)}</div></details>
    </section>
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
          <div><RiskBadge risk={escalated.ids.includes(reply.id) ? "red" : reply.risk} /><div className="action-menu-wrap"><button className={`icon-button ${moreOpen ? "active" : ""}`} onClick={() => setMoreOpen((value) => !value)} aria-label="اقدام‌های بیشتر" aria-expanded={moreOpen}>•••</button>{moreOpen && <div className="action-menu"><button onClick={async () => { await navigator.clipboard?.writeText(reply.original); setMoreOpen(false); notify("متن اصلی کاربر کپی شد"); }}>کپی متن کاربر</button><button onClick={() => { setMoreOpen(false); window.open(`https://x.com/i/web/status/${reply.id}`, "_blank", "noopener,noreferrer"); }}>مشاهده کامنت در X ↗</button></div>}</div></div>
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
          <div className="source-strip"><span>منبع ورودی</span><b>منشن واقعی اکانت در X</b><b>پاسخ پیشنهادی مدیر هوشمند</b></div>
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

function ContentView({ content, onContentChange, sentIds, onMarkSent, onRetryImages }: { content: ContentItem[]; onContentChange: (items: ContentItem[]) => void; sentIds: string[]; onMarkSent: (id: string) => void; onRetryImages: () => void }) {
  const [filter, setFilter] = useState<"all" | Risk>("all");
  const [status, setStatus] = useState<"all" | "ready" | "sent">("all");
  const [toast, setToast] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
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
            {item.imageUrl ? <div className="generated-post-image"><button className="image-preview-button" type="button" onClick={() => setPreviewImage({ src: item.imageUrl!, title: item.title })} aria-label={`بزرگ‌نمایی تصویر ${item.title}`}><Image src={item.imageUrl} alt={`تصویر اختصاصی ${item.title}`} width={1024} height={576} unoptimized /><i aria-hidden="true">⌕</i></button><span>برای مشاهده بزرگ‌تر روی تصویر بزنید</span></div> : item.imageError ? <div className="generated-post-image pending failed"><strong>تولید تصویر کامل نشد</strong><span>{item.imageError}</span><button className="btn quiet" onClick={onRetryImages}>تلاش دوباره برای تصویر</button></div> : <div className="generated-post-image pending"><span className="button-spinner"/><strong>تصویر اختصاصی در حال تولید است…</strong></div>}
            <div className="content-meta"><span>{item.language}</span><span>{item.time}</span></div>
            <div className="source-box"><span>منبع</span><strong>{item.source}</strong></div>
            <div className="publish-copy" dir="auto"><span>متن نهایی برای X</span><p>{item.postText}</p></div>
            <div className="operator-steps compact"><span><b>۱</b> کپی</span><span><b>۲</b> انتشار در X</span><span><b>۳</b> ثبت در داشبورد</span></div>
            <div className="card-actions"><button className="btn quiet" onClick={() => openEditor(item)}>ویرایش</button><button className="btn accent" onClick={() => copyPost(item.postText)}>کپی متن</button><button className="btn primary" onClick={() => window.open("https://x.com/compose/post", "_blank", "noopener,noreferrer")}>بازکردن X ↗</button><button className={`btn sent-action ${isSent ? "done" : ""}`} disabled={isSent} onClick={() => { onMarkSent(item.id); notify("پست به‌عنوان منتشرشده ثبت شد"); }}>{isSent ? "✓ انتشار ثبت شد" : "من این پست را منتشر کردم"}</button></div>
          </article>;
        })}
      </div>
      {visibleItems.length === 0 && <div className="panel empty-state"><strong>{content.length ? "موردی با این فیلتر پیدا نشد." : "هنوز محتوای واقعی آماده نشده است."}</strong><p>{content.length ? "فیلتر وضعیت یا ریسک را تغییر دهید." : "پس از تکمیل برنامه زنده و تأیید منابع، پست واقعی اینجا ظاهر می‌شود."}</p></div>}
      {toast && <div className="toast">✓ {toast}</div>}
      {previewImage && <ImageLightbox src={previewImage.src} title={previewImage.title} onClose={() => setPreviewImage(null)} />}
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

function TelegramView() {
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
      <div className="panel-head"><div><span className="eyebrow">رویدادهای واقعی</span><h3>اعلان‌های اخیر</h3></div></div>
      <div className="telegram-messages"><div className="empty-state"><strong>هنوز اعلان واقعی ثبت نشده است.</strong><p>پس از آماده‌شدن پست، دریافت کامنت، هشدار بودجه یا پایان پژوهش، اعلان این بخش از رویداد واقعی ساخته می‌شود.</p></div></div>
    </article>

    <article className="panel notification-rules">
      <div className="panel-head"><div><span className="eyebrow">قوانین اعلان</span><h3>چه زمانی گروه مطلع شود؟</h3><p>اعلان‌های تکراری با کلید یکتا حذف می‌شوند تا گروه شلوغ نشود.</p></div></div>
      <div className="rule-list">{notificationRules.map((rule, index) => <div className="notification-rule" key={rule[0]}><button className={`switch ${enabled[index] ? "on" : ""}`} onClick={() => setEnabled((current) => current.map((value, currentIndex) => currentIndex === index ? !value : value))} aria-label={`فعال یا غیرفعال‌کردن ${rule[0]}`}><i/></button><div><strong>{rule[0]}</strong><small>{rule[1]}</small></div><span>{enabled[index] ? "فعال" : "خاموش"}</span></div>)}</div>
    </article>
  </section>;
}

function ResearchView() {
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([]);
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
        const stored = JSON.parse(window.localStorage.getItem("wallet-social-research-results-live-v2") || "null");
        if (Array.isArray(stored) && stored.length) setResearchItems(stored);
      } catch {
        setResearchItems([]);
      }
      setResearchReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);
  useEffect(() => {
    if (researchReady) window.localStorage.setItem("wallet-social-research-results-live-v2", JSON.stringify(researchItems));
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
      {researchItems.length === 0 && <article className="panel empty-state"><strong>هنوز پژوهش واقعی اجرا نشده است.</strong><p>با «اجرای پژوهش هدفمند» یک موضوع واقعی را برای Firecrawl بفرستید؛ نتیجه و منابع همین‌جا ثبت می‌شوند.</p></article>}
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

function StrategyView({ onNavigate, plan }: { onNavigate: (view: View) => void; plan: DailyManagerPlan | null }) {
  if (!plan) return <section className="strategy-view"><article className="panel empty-state"><strong>برنامه واقعی هنوز ساخته نشده است.</strong><p>مدیر هوشمند پس از دریافت داده زنده Firecrawl، برنامه روز را تولید می‌کند. تا آن زمان هیچ زمان، هدف یا پیشنهاد ساختگی نمایش داده نمی‌شود.</p><button className="btn accent" onClick={() => onNavigate("research")}>بررسی منابع زنده ←</button></article></section>;
  const scheduledItems = [
    ...plan.posts.map((post) => ({ id: `post-${post.id}`, time: post.time, type: "انتشار", title: post.title, detail: post.summaryFa })),
    ...plan.interactions.map((item) => ({ id: `interaction-${item.id}`, time: "امروز", type: "تعامل", title: item.account, detail: item.reason })),
  ];
  return <section className="strategy-view">
    <div className="strategy-hero panel lift-card"><div><span className="eyebrow">برنامه زنده · {plan.date}</span><h2>{plan.todayGoal}</h2><p>{plan.rationale}</p></div><div className="strategy-score"><span>وضعیت داده</span><strong>زنده</strong><small>بر پایه منابع ثبت‌شده امروز</small></div></div>
    <div className="strategy-kpis">
      <article className="panel lift-card"><span>پست آماده</span><strong>{plan.posts.length.toLocaleString("fa-IR")}</strong><small>دارای متن و منبع</small></article>
      <article className="panel lift-card"><span>تعامل هدفمند</span><strong>{plan.interactions.length.toLocaleString("fa-IR")}</strong><small>دارای لینک واقعی X</small></article>
      <article className="panel lift-card"><span>کار امروز</span><strong>{plan.tasks.length.toLocaleString("fa-IR")}</strong><small>دستور دقیق اپراتور</small></article>
      <article className="panel lift-card"><span>سیگنال زنده</span><strong>{plan.signals.length.toLocaleString("fa-IR")}</strong><small>استخراج‌شده از منابع واقعی</small></article>
    </div>
    <article className="panel strategy-calendar"><div className="panel-head"><div><span className="eyebrow">تقویم اجرایی امروز</span><h3>موارد تولیدشده توسط مدیر هوشمند</h3><p>فقط زمان‌ها و اقدام‌هایی نمایش داده می‌شوند که در برنامه واقعی امروز وجود دارند.</p></div></div>
      {scheduledItems.length ? <div className="calendar-grid">{scheduledItems.map((item) => <div className="calendar-day lift-card" key={item.id}><header><strong>{item.type}</strong><small>{item.time}</small></header><div className="calendar-slot"><b>{item.title}</b><p>{item.detail}</p></div></div>)}</div> : <div className="empty-state"><strong>برای امروز اسلاتی ثبت نشده است.</strong><p>این توقف بخشی از خروجی واقعی برنامه امروز است.</p></div>}
    </article>
    <div className="logic-grid"><article className="panel lift-card"><span className="eyebrow">منطق تصمیم امروز</span><h3>چرا این برنامه ساخته شد؟</h3><p>{plan.rationale}</p></article><article className="panel lift-card action-panel"><span className="eyebrow">قدم بعد اپراتور</span><h3>کارهای واقعی امروز را اجرا کن</h3><p>هر ردیف زمان، متن و مقصد دقیق دارد.</p><button className="btn accent" onClick={() => onNavigate("tasks")}>شروع کارهای امروز ←</button></article></div>
  </section>;
}


function TasksView({ onNavigate, plan }: { onNavigate: (view: View) => void; plan: DailyManagerPlan | null }) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try { setDone(JSON.parse(localStorage.getItem('wallet-social-daily-tasks-live-v2') || '[]')); } catch { setDone([]); }
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);
  useEffect(() => { localStorage.setItem('wallet-social-daily-tasks-live-v2', JSON.stringify(done)); }, [done]);
  const tasks = plan?.tasks.map((task) => ({ id: task.id, time: task.time, title: task.title, detail: task.instruction, target: task.kind === "publish" ? "content" as View : task.kind === "reply" ? "replies" as View : task.kind === "interact" ? "growth" as View : task.kind === "research" ? "research" as View : "sent" as View, priority: task.priority === "now" ? "الان" : task.priority === "today" ? "امروز" : "اختیاری" })) || [];
  const percent = tasks.length ? Math.round((done.filter((id) => tasks.some((task) => task.id === id)).length / tasks.length) * 100) : 0;
  return <section className="tasks-view">
    <div className="tasks-summary panel"><div><span className="eyebrow">{plan ? "برنامه زنده امروز" : "در انتظار داده زنده"}</span><h2>{tasks.length === 0 ? "هنوز کاری برای امروز ساخته نشده است" : done.filter((id) => tasks.some((task) => task.id === id)).length === tasks.length ? 'همه کارهای امروز انجام شد' : `${(tasks.length - done.filter((id) => tasks.some((task) => task.id === id)).length).toLocaleString('fa-IR')} کار تا پایان برنامه امروز`}</h2><p>{plan?.todayGoal || "پس از تکمیل برنامه زنده، دستورهای واقعی اپراتور اینجا ظاهر می‌شوند."}</p></div><div className="daily-progress"><strong>{percent.toLocaleString('fa-IR')}٪</strong><span><i style={{width:`${percent}%`}}/></span><small>{done.filter((id) => tasks.some((task) => task.id === id)).length.toLocaleString('fa-IR')} از {tasks.length.toLocaleString('fa-IR')} تکمیل‌شده</small></div></div>
    <div className="task-list">{tasks.map((task, index) => { const checked = done.includes(task.id); return <article className={`panel task-row lift-card ${checked ? 'completed' : ''}`} key={task.id}><button className="task-check" onClick={() => setDone((current) => checked ? current.filter((id) => id !== task.id) : [...current, task.id])} aria-label={checked ? 'بازگرداندن کار' : 'علامت‌گذاری انجام شد'}>{checked ? '✓' : (index + 1).toLocaleString('fa-IR')}</button><time>{task.time}</time><div><span>{task.priority}</span><h3>{task.title}</h3><p>{task.detail}</p></div><button className="btn quiet" onClick={() => onNavigate(task.target)}>رفتن به بخش ←</button></article>; })}</div>
    {tasks.length === 0 && <article className="panel empty-state"><strong>هیچ وظیفه آزمایشی نمایش داده نمی‌شود.</strong><p>در اولین اجرای موفق مدیر هوشمند، لیست واقعی امروز جایگزین این پیام می‌شود.</p></article>}
  </section>;
}


function CreativeView({ onNavigate, plan }: { onNavigate: (view: View) => void; plan: DailyManagerPlan | null }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("انگلیسی");
  const [state, setState] = useState<"idle"|"running"|"success"|"error">("idle");
  const [message, setMessage] = useState("");
  const run = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setState("running"); setMessage(""); try { const response = await fetch("/api/research", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ topic, scope:"منابع رسمی پروژه، مستندات بلاکچین و منابع خبری معتبر" }) }); const data = await response.json() as {ok?:boolean; result?:ResearchItem; error?:string}; if (!response.ok || !data.ok || !data.result) throw new Error(data.error || "ساخت بسته ناموفق بود."); localStorage.setItem("wallet-social-last-creative-brief-live-v2", JSON.stringify({ topic, language, source:data.result, createdAt:new Date().toISOString() })); setState("success"); setMessage("منابع واقعی بررسی شدند. خروجی در پژوهش زنده ثبت شد و مدیر هوشمند در اجرای بعدی از آن استفاده می‌کند."); } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "ساخت بسته ناموفق بود."); } };
  const posts = plan?.posts || [];
  return <section className="creative-view">
    <div className="creative-hero panel lift-card"><div><span className="eyebrow">بسته کامل انتشار</span><h2>محتوا فقط از داده و منبع واقعی ساخته می‌شود.</h2><p>هیچ نمونه آماده‌ای نمایش داده نمی‌شود؛ متن، ترجمه و تصویر پس از تحلیل منابع زنده ظاهر می‌شوند.</p><button className="btn accent" onClick={() => { setState("idle"); setOpen(true); }}>پژوهش برای محتوای جدید ✦</button></div><div className="creative-pipeline">{["سیگنال زنده","راستی‌آزمایی","متن و ترجمه","تصویر اختصاصی","تأیید انسانی"].map((step,index) => <div key={step}><span>{(index+1).toLocaleString("fa-IR")}</span><b>{step}</b></div>)}</div></div>
    {posts.length ? <div className="creative-grid">{posts.map((post) => <article className="panel content-package lift-card" key={post.id}><header><RiskBadge risk={post.risk}/><b>{post.language}</b></header><h3>{post.title}</h3><p>{post.summaryFa}</p>{post.imageUrl ? <div className="generated-post-image"><Image src={post.imageUrl} alt={post.title} width={1024} height={576} unoptimized /></div> : null}<footer><span>امروز · {post.time}</span><button className="btn accent" onClick={() => onNavigate("content")}>بازبینی در صف محتوا</button></footer></article>)}</div> : <article className="panel empty-state"><strong>هنوز بسته محتوای واقعی ساخته نشده است.</strong><p>پس از اجرای موفق برنامه روزانه یا پژوهش جدید، خروجی منبع‌دار اینجا نمایش داده می‌شود.</p></article>}
    {open && <ModalShell title="پژوهش برای بسته محتوای جدید" eyebrow="Firecrawl + مدیر هوشمند" onClose={() => state !== "running" && setOpen(false)} closeDisabled={state === "running"} footer={<><button className="btn quiet" onClick={() => setOpen(false)} disabled={state==="running"}>بستن</button><button className="btn accent" type="submit" form="creative-form" disabled={state==="running" || topic.trim().length < 8}>{state==="running" ? "در حال بررسی منابع…" : "شروع پژوهش واقعی"}</button></>}><form id="creative-form" className="creative-form" onSubmit={run}><label>موضوع یا خبر واقعی<textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="موضوع دقیق را وارد کنید" /></label><label>زبان اصلی<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>انگلیسی</option><option>فارسی</option><option>اسپانیایی</option><option>عربی</option></select></label>{message && <div className={`generation-message ${state}`}>{message}</div>}</form></ModalShell>}
  </section>;
}


function GrowthView({ plan }: { plan: DailyManagerPlan | null }) {
  const [copied, setCopied] = useState('');
  const copy = (id:string, value:string) => { void navigator.clipboard.writeText(value); setCopied(id); window.setTimeout(() => setCopied(''), 1800); };
  const opportunities = plan?.interactions.map((item) => ({ id: item.id, topic: item.account, query: item.postUrl, reason: item.reason, comment: item.comment, directUrl: item.postUrl })) || [];
  return <section className="growth-view">
    <div className="growth-hero panel"><div><span className="eyebrow">رشد باکیفیت، نه اسپم</span><h2>سه تعامل معنی‌دار بهتر از سی کامنت تکراری است.</h2><p>عامل موضوع و متن را پیشنهاد می‌دهد؛ اپراتور پست واقعی را می‌بیند و فقط پس از اطمینان منتشر می‌کند.</p></div><div className="api-gate"><i>✓</i><div><strong>اعتبار X برای رشد مصرف نمی‌شود</strong><small>برای حفظ ۵ دلار Owned Reads، پیدا کردن پست هدف با لینک جست‌وجوی دستی انجام می‌شود.</small></div></div></div>
    <div className="growth-layout"><div className="opportunity-list">{opportunities.map((item) => <article className="panel opportunity-card lift-card" key={item.id}><header><div><span className="eyebrow">فرصت زنده امروز</span><h3>{item.topic}</h3></div><span className="match-score">LIVE</span></header><div className="target-query"><small>لینک پست واقعی در X</small><code dir="ltr">{item.query}</code></div><p>{item.reason}</p><blockquote dir="ltr">{item.comment}</blockquote><footer><a className="btn quiet" href={item.directUrl} target="_blank" rel="noreferrer">بازکردن پست در X ↗</a><button className="btn accent" onClick={() => copy(item.id,item.comment)}>{copied === item.id ? '✓ کپی شد' : 'کپی کامنت پیشنهادی'}</button></footer></article>)}{opportunities.length === 0 && <article className="panel empty-state"><strong>فرصت تعامل واقعی پیدا نشده است.</strong><p>تا زمانی که مدیر هوشمند یک پست واقعی و مرتبط در X پیدا نکند، پیشنهادی نمایش داده نمی‌شود.</p></article>}</div>
      <aside className="growth-side"><article className="panel guard-card"><span className="eyebrow">گارد ضداسپم</span><h3>قبل از هر تعامل</h3><ul><li><b>ارتباط:</b> پست باید واقعاً درباره موضوع محصول باشد.</li><li><b>اصالت:</b> شباهت با کامنت‌های قبلی کمتر از ۷۲٪.</li><li><b>تعداد:</b> حداکثر ۳ تا ۵ تعامل دستی باکیفیت در روز.</li><li><b>توقف:</b> پاسخ تکراری، لایک خودکار و فالو انبوه ممنوع.</li></ul></article><article className="panel target-accounts"><span className="eyebrow">سبد اکانت هدف</span><h3>چه کسانی ارزش رصد دارند؟</h3>{[['پژوهشگران امنیت وب۳','اعتماد و آموزش'],['تحلیل‌گران داده آن‌چین','اثبات کاربرد'],['اکوسیستم‌های Solana و EVM','کشف مخاطب'],['سازندگان ابزار معامله‌گری','همکاری محصول']].map((item) => <div key={item[0]}><span>◎</span><p><strong>{item[0]}</strong><small>{item[1]}</small></p><b>روزانه</b></div>)}</article></aside></div>
  </section>;
}


function BudgetView() {
  return (
    <section>
      <div className="budget-hero panel"><div><span className="eyebrow">محافظ هزینه فعال</span><h2>۵ دلار فقط برای خواندن کامنت‌های جدید</h2><p>هیچ جست‌وجو، انتشار پست، تولید محتوا یا درخواست Firecrawl از اعتبار X استفاده نمی‌کند.</p></div><div className="budget-bar-large reserved"><span style={{width:"0%"}}/><i className="mark half">هشدار ۲٫۵۰ دلار</i><i className="mark high">هشدار ۴ دلار</i></div></div>
      <div className="usage-grid">
        <article className="panel usage-card"><span className="eyebrow">اعتبار خریداری‌شده</span><strong>۵٫۰۰ دلار</strong><p>سقف سخت همین مقدار است</p><small>Auto Recharge باید خاموش بماند</small></article>
        <article className="panel usage-card"><span className="eyebrow">هزینه Owned Read</span><strong>۰٫۰۰۱ دلار</strong><p>برای هر منشن جدید برگشتی</p><small>هزینه بر اساس منبع جدید است، نه تعداد Poll</small></article>
        <article className="panel usage-card"><span className="eyebrow">ظرفیت نظری</span><strong>تا ۵٬۰۰۰</strong><p>منشن جدید با ۵ دلار</p><small>مصرف دقیق و زنده در X Console نمایش داده می‌شود</small></article>
      </div>
      <article className="panel budget-explanation"><strong>این صفحه را چطور بخوانم؟</strong><ol><li>سامانه هر ۲ دقیقه فقط مسیر منشن‌های اکانت خودمان را بررسی می‌کند.</li><li>اگر کامنت جدیدی نباشد، منبع تازه‌ای برای محاسبه هزینه دریافت نمی‌شود.</li><li>شناسه آخرین منشن ذخیره می‌شود تا موارد قدیمی عمداً دوباره درخواست نشوند.</li><li>در ۲٫۵۰ دلار و ۴ دلار به تلگرام هشدار ارسال می‌شود؛ در ۵ دلار پایش متوقف می‌شود.</li></ol></article>
      <article className="panel alert-policy"><div className="panel-head"><div><span className="eyebrow">محافظ‌های خودکار</span><h3>هشدارهای اعتبار</h3></div><span className="live-pill"><i/> فعال</span></div><div className="policy-row"><span className="policy-level warning">۵۰٪</span><div><strong>هشدار اولیه در ۲٫۵۰ دلار</strong><small>اعلان تلگرام؛ پایش ادامه دارد</small></div><b>فعال</b></div><div className="policy-row"><span className="policy-level critical">۸۰٪</span><div><strong>هشدار مهم در ۴ دلار</strong><small>اعلان فوری به مدیر</small></div><b>فعال</b></div><div className="policy-row"><span className="policy-level stop">۱۰۰٪</span><div><strong>توقف قطعی در ۵ دلار</strong><small>فقط Polling منشن‌ها متوقف می‌شود؛ داشبورد باز می‌ماند.</small></div><b>محافظت‌شده</b></div></article>
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
  const [xConnection, setXConnection] = useState<XConnection | null>(null);
  const [xChecking, setXChecking] = useState(true);
  const checkXConnection = useCallback(async () => {
    setXChecking(true);
    try {
      const response = await fetch("/api/x", { cache: "no-store" });
      const payload = await response.json() as XConnection;
      setXConnection(payload);
    } catch {
      setXConnection({ configured: true, connected: false, error: "ارتباط داشبورد با سرویس X برقرار نشد." });
    } finally {
      setXChecking(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void checkXConnection(); }, 0);
    return () => window.clearTimeout(timer);
  }, [checkXConnection]);
  const saveSettings = () => {
    window.localStorage.setItem("wallet-social-settings", JSON.stringify(settings));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };
  return <section>
    <div className="settings-grid">
      <article className="panel settings-card"><div className="panel-head"><div><span className="eyebrow">اتصال به X</span><h3>فقط پایش کامنت‌های خودمان</h3></div><button className={`switch ${settings.polling ? "on" : ""}`} onClick={() => setSettings({ ...settings, polling: !settings.polling })} aria-label="فعال یا غیرفعال‌کردن پایش" aria-pressed={settings.polling}><i/></button></div><div className="x-account-card"><span className="avatar">WT</span><div><small>اکانت رسمی پروژه</small><strong dir="ltr">{X_ACCOUNT_HANDLE}</strong></div><a href={X_ACCOUNT_URL} target="_blank" rel="noreferrer">مشاهده در X ↗</a></div><div className={`x-connection-status ${xConnection?.connected ? "connected" : xConnection?.needsCredit ? "credit" : "error"}`}><span><i />{xChecking ? "در حال بررسی تنظیمات امن…" : xConnection?.connected ? "کلیدها ثبت شده‌اند و فقط مسیر منشن‌ها مجاز است" : xConnection?.needsCredit ? "اعتبار X API نیاز به شارژ دارد" : xConnection?.error || "تنظیمات X هنوز کامل نشده است"}</span><button type="button" onClick={() => void checkXConnection()} disabled={xChecking}>{xChecking ? "بررسی…" : "بررسی تنظیمات"}</button></div><label>فاصله زمانی پایش<select value={settings.interval} onChange={(event) => setSettings({ ...settings, interval: event.target.value })}><option value="120">هر ۲ دقیقه</option><option value="300">هر ۵ دقیقه</option></select></label><label>سقف قطعی Owned Reads<div className="input-prefix"><span>$</span><input value="5.00" readOnly aria-label="سقف ثابت پنج دلار"/></div></label><div className="settings-note">این سقف قفل است. فقط مسیر <code>GET /2/users/:id/mentions</code> مجاز است و شناسه آخرین منشن برای جلوگیری از خواندن عمدی موارد قدیمی ذخیره می‌شود.</div></article>
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
  const managedReplies = useStoredCollection<ReplyItem>("wallet-social-reply-items-live-v2", replies);
  const managedContent = useStoredCollection<ContentItem>("wallet-social-content-items-live-v2", contentItems);
  const dailyManager = useDailyManagerPlan();
  const setManagedContent = managedContent.setItems;
  const setManagedReplies = managedReplies.setItems;

  useEffect(() => {
    [
      "wallet-social-reply-items",
      "wallet-social-content-items",
      "wallet-social-research-results",
      "wallet-social-daily-tasks",
      "wallet-social-last-creative-brief",
    ].forEach((key) => window.localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncInbox = async () => {
      try {
        const response = await fetch("/api/x/inbox", { cache: "no-store" });
        const payload = await response.json() as { ok?: boolean; replies?: ReplyItem[] };
        if (!cancelled && response.ok && payload.ok && payload.replies?.length) {
          setManagedReplies((current) => {
            const liveIds = new Set(payload.replies!.map((item) => item.id));
            return [...payload.replies!, ...current.filter((item) => !liveIds.has(item.id))];
          });
        }
      } catch {
        // The existing inbox remains usable while the next free sync retries.
      }
    };
    void syncInbox();
    const timer = window.setInterval(() => void syncInbox(), 120_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [setManagedReplies]);

  useEffect(() => {
    if (!dailyManager.plan) return;
    const generatedItems: ContentItem[] = dailyManager.plan.posts.map((post) => ({ id: `live-${dailyManager.plan!.date}-${post.id}`, type: "پیشنهاد زنده مدیر هوشمند", title: post.title, body: post.summaryFa, language: post.language, risk: post.risk, time: `امروز · ${post.time}`, source: `${post.sourceUrls.length.toLocaleString("fa-IR")} منبع زنده Firecrawl`, postText: post.copy, imageUrl: post.imageUrl, imageError: dailyManager.imageErrors[post.id], sourceUrls: post.sourceUrls }));
    setManagedContent((current) => {
      const generatedIds = new Set(generatedItems.map((item) => item.id));
      const previous = current.filter((item) => !item.id.startsWith("live-") && !generatedIds.has(item.id));
      return [...generatedItems, ...previous];
    });
  }, [dailyManager.imageErrors, dailyManager.plan, setManagedContent]);

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
          {navGroups.map((group) => {
            const links = group.items.map((item) => <button key={item.id} className={`nav-link ${targetView === item.id ? "active" : ""} ${transitionPhase !== "idle" && targetView === item.id ? "pending" : ""}`} onClick={() => changeView(item.id)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>);
            return "collapsible" in group && group.collapsible ? <details className="nav-group manager-nav" key={group.label}><summary>{group.label}<span>⌄</span></summary>{links}</details> : <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{links}</div>;
          })}
        </nav>
        <div className="automation-card simple"><div className="automation-head"><span>بررسی خودکار کامنت‌ها</span><i className="status-dot"/></div><strong>بررسی بعدی تا <b>{time}</b></strong><p>اگر کامنت تازه‌ای باشد، در «پاسخ‌های آماده» می‌بینی.</p><button className="btn accent full" onClick={() => changeView("replies")}>رفتن به پاسخ‌ها ←</button></div>
      </aside>

      {mobileNav && <button className="nav-overlay" onClick={() => setMobileNav(false)} aria-label="بستن منو"/>}

      <main className="main">
        <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileNav(true)} aria-label="بازکردن منو">☰</button><div className="view-heading" key={view}><div className="title-line"><h1>{viewMeta[view].title}</h1><span className="system-pill"><i/> آماده کار</span></div><p>{viewMeta[view].sub}</p></div></div><div className="topbar-actions"><button className={`btn quiet refresh-button ${transitionPhase !== "idle" ? "spinning" : ""}`} onClick={refreshView}><span aria-hidden="true">↻</span> تازه‌سازی</button><button className="logout-button" onClick={() => void logout()} disabled={loggingOut} aria-label="خروج از داشبورد"><span aria-hidden="true">↪</span><b>{loggingOut ? "در حال خروج" : "خروج"}</b></button></div></header>
        <div className={`content content-stage ${transitionPhase === "leaving" ? "is-leaving" : ""}`} aria-busy={isLoading || transitionPhase !== "idle"}>
          {(isLoading || transitionPhase === "loading") ? <ViewSkeleton /> : <div className="view-enter" key={view}>
            {view === "overview" && <Overview onNavigate={changeView} manager={dailyManager}/>}
            {view === "strategy" && <StrategyView onNavigate={changeView} plan={dailyManager.plan}/>}
            {view === "tasks" && <TasksView onNavigate={changeView} plan={dailyManager.plan}/>}
            {view === "creative" && <CreativeView onNavigate={changeView} plan={dailyManager.plan}/>}
            {view === "growth" && <GrowthView plan={dailyManager.plan}/>}
            {view === "replies" && <RepliesView replyItems={managedReplies.items} onRepliesChange={managedReplies.setItems} sentIds={sentReplies.ids} onMarkSent={sentReplies.mark}/>}
            {view === "content" && <ContentView content={managedContent.items} onContentChange={managedContent.setItems} sentIds={sentPosts.ids} onMarkSent={sentPosts.mark} onRetryImages={() => void dailyManager.retryImages()}/>}
            {view === "sent" && <SentView replyIds={sentReplies.ids} postIds={sentPosts.ids} replyItems={managedReplies.items} content={managedContent.items}/>}
            {view === "telegram" && <TelegramView/>}
            {view === "research" && <ResearchView/>}
            {view === "budget" && <BudgetView/>}
            {view === "settings" && <SettingsView/>}
          </div>}
        </div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="دسترسی سریع موبایل">
        {[{ id: "overview" as View, icon: "⌂", label: "امروز" }, { id: "content" as View, icon: "۱", label: "پست" }, { id: "replies" as View, icon: "۲", label: "پاسخ" }, { id: "tasks" as View, icon: "✓", label: "کارها" }].map((item) => <button key={item.id} className={`${targetView === item.id ? "active" : ""} ${transitionPhase !== "idle" && targetView === item.id ? "pending" : ""}`} onClick={() => changeView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}
      </nav>
    </div>
  );
}
