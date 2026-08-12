import { AdminConsole } from "../components/admin-console";
import { loadAdminConsoleSnapshot } from "../lib/admin-api-client";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName,getAdminSession } from "../lib/admin-auth-client";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const jar=await cookies();
  if(!await getAdminSession(jar.get(cookieName())?.value??null))redirect("/login");
  const initialSnapshot = await loadAdminConsoleSnapshot({ requestHeaders: await headers() });
  return <AdminConsole initialSnapshot={initialSnapshot} buildId={process.env.TIKDD_ADMIN_BUILD_ID ?? "development"} />;
}
