"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Image from "next/image";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!username.trim() || !password) {
      setError(!username.trim() ? "نام کاربری را وارد کنید." : "رمز عبور را وارد کنید.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, next: nextPath }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; next?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "ورود انجام نشد. دوباره تلاش کنید.");
      window.location.assign(data.next || "/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ورود انجام نشد. دوباره تلاش کنید.");
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-glow login-glow-one" aria-hidden="true" />
      <div className="login-glow login-glow-two" aria-hidden="true" />
      <section className="login-shell" aria-label="ورود به مرکز مدیریت Wallet Tracker">
        <aside className="login-story">
          <a className="login-brand" href="https://wallettracker.app" target="_blank" rel="noreferrer">
            <Image src="/brand/wallet-tracker-x-avatar-400.png" alt="لوگوی Wallet Tracker" width={52} height={52} priority unoptimized />
            <span><strong>Wallet Tracker</strong><small>Social Operations</small></span>
          </a>
          <span className="login-private"><i /> فضای کاری خصوصی</span>
          <div className="login-story-copy">
            <p className="login-kicker">کنترل عملیات شبکه اجتماعی</p>
            <h1>انتشار دقیق‌تر.<br /><em>پاسخ‌گویی سریع‌تر.</em></h1>
            <p>محتوا، پاسخ‌های چندزبانه و سیگنال‌های زنده را از یک میز امن بررسی و مدیریت کنید.</p>
          </div>
          <div className="login-radar" aria-hidden="true"><span /><span /><span /><i /></div>
          <div className="login-status-grid">
            <div><span>Owned Reads</span><strong><i /> فعال</strong></div>
            <div><span>Human Review</span><strong><i /> اجباری</strong></div>
            <div><span>Budget Guard</span><strong><i /> محافظت‌شده</strong></div>
          </div>
        </aside>

        <section className="login-panel">
          <div className="login-mobile-brand"><Image src="/brand/wallet-tracker-x-avatar-400.png" alt="لوگوی Wallet Tracker" width={34} height={34} priority unoptimized /><strong>Wallet Tracker</strong></div>
          <span className="secure-access"><i>✓</i> دسترسی امن</span>
          <div className="login-heading">
            <h2>خوش آمدید</h2>
            <p>برای ورود به مرکز مدیریت شبکه اجتماعی، اطلاعات حساب اپراتور را وارد کنید.</p>
          </div>

          <form className="login-form" onSubmit={submit} noValidate>
            <label htmlFor="dashboard-username">نام کاربری</label>
            <div className={`login-field ${error && !username.trim() ? "invalid" : ""}`}>
              <span aria-hidden="true">◎</span>
              <input id="dashboard-username" name="username" type="text" dir="ltr" autoComplete="username" value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} placeholder="operator" aria-invalid={Boolean(error && !username.trim())} autoFocus />
            </div>

            <label htmlFor="dashboard-password">رمز عبور</label>
            <div className={`login-field ${error && username.trim() && !password ? "invalid" : ""}`}>
              <span aria-hidden="true">◇</span>
              <input id="dashboard-password" name="password" type={showPassword ? "text" : "password"} dir="ltr" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="••••••••••••" aria-invalid={Boolean(error && username.trim() && !password)} />
              <button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "پنهان‌کردن رمز عبور" : "نمایش رمز عبور"}>{showPassword ? "◉" : "○"}</button>
            </div>

            <div className={`login-error ${error ? "visible" : ""}`} role="alert" aria-live="polite">{error || "اطلاعات ورود نادرست است."}</div>
            <button className={`login-submit ${submitting ? "loading" : ""}`} type="submit" disabled={submitting}>
              <span>{submitting ? "در حال بررسی…" : "ورود به داشبورد"}</span>
              <i aria-hidden="true">←</i>
            </button>
          </form>

          <footer className="login-footer"><span>© ۲۰۲۶ Wallet Tracker</span><a href="https://wallettracker.app" target="_blank" rel="noreferrer">مشاهده وب‌سایت ↗</a></footer>
        </section>
      </section>
    </main>
  );
}
