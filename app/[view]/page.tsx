import { redirect } from "next/navigation";
import DashboardClient from "../dashboard-client";
import { hasDashboardSession, safeDashboardPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  const requestedPath = safeDashboardPath(`/${view}`);
  if (requestedPath === "/") redirect("/");
  if (!(await hasDashboardSession())) {
    redirect(`/login?next=${encodeURIComponent(requestedPath)}`);
  }
  return <DashboardClient />;
}
