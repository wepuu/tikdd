import { NextResponse } from "next/server";
import { getPublishedContentHealth, getPublishedSnapshot } from "../../../../../lib/published-content";

export const dynamic = "force-dynamic";
export async function GET() {
  await getPublishedSnapshot();
  return NextResponse.json(getPublishedContentHealth(), { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
}
