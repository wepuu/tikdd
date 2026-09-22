import { adsTxtLine } from "../../components/site-integrations";
import { getPublishedSnapshot } from "../../lib/published-content";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const publisherId = (await getPublishedSnapshot()).siteIntegrations.googleAdsensePublisherId;
  return new Response(publisherId ? `${adsTxtLine(publisherId)}\n` : "", {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
