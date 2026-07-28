import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { hasDashboardSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasDashboardSession())) redirect("/login");
  return <DashboardClient />;
}
