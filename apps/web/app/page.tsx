import { redirect } from "next/navigation";
import { getPublishedSnapshot } from "../lib/published-content";

export default async function RootPage() {
  const snapshot = await getPublishedSnapshot();
  const locale = snapshot.locales.find((item) => item.isDefault)?.locale ?? "en";
  redirect(`/${locale}`);
}
