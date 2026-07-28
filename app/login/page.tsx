import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "./login-form";
import { hasDashboardSession, safeDashboardPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ورود امن | Wallet Tracker",
  description: "ورود به مرکز مدیریت شبکه اجتماعی Wallet Tracker",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = safeDashboardPath(typeof params.next === "string" ? params.next : "/");
  if (await hasDashboardSession()) redirect(nextPath);
  return <LoginForm nextPath={nextPath} />;
}
