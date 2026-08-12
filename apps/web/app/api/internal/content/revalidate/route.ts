import { PublicContentRevalidationAcknowledgementSchema, PublicContentRevalidationCommandSchema } from "@tikdd/admin-contracts";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { acknowledgePublishedSnapshot, localizedPath } from "../../../../../lib/published-content";
import { verifyContentRevalidation } from "../../../../../lib/revalidation-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.PUBLIC_CONTENT_REVALIDATION_SECRET ?? "";
  const body = await request.text();
  if (!verifyContentRevalidation(secret, request.headers.get("x-tikdd-content-timestamp"), request.headers.get("x-tikdd-content-signature"), body)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const command = PublicContentRevalidationCommandSchema.parse(JSON.parse(body));
    const snapshot = await acknowledgePublishedSnapshot(command.snapshotId);
    const allowed = new Set(snapshot.pages.flatMap((page) => [localizedPath(page.locale, page.seo.localPath), ...page.seo.redirectFrom.map((path) => localizedPath(page.locale, path))]));
    if (command.paths.some((path) => !allowed.has(path))) throw new Error("A requested route is outside the candidate snapshot.");
    for (const path of command.paths) revalidatePath(path, "page");
    revalidatePath("/sitemap.xml");
    const response = PublicContentRevalidationAcknowledgementSchema.parse({ schemaVersion: "1", acknowledged: true, snapshotId: snapshot.snapshotId, contentHash: snapshot.contentHash, checkedAt: new Date().toISOString() });
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "candidate_rejected" }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
