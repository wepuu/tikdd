import { loadAdminApiConnection, loadAdminConsoleSnapshot, sendAdminContentCommand, sendAdminPlatformCommand, sendAdminRecoveryCommand, sendAdminRouteCommand, type AdminRouteSelection } from "../../../../lib/admin-api-client";
import { AdminRoutePolicyDiscardCommandSchema,AdminRoutePolicyDraftCommandSchema,AdminRoutePolicyPublishCommandSchema,AdminRoutePolicyRollbackCommandSchema } from "@tikdd/admin-contracts";
import { AdminRouteProbeCommandSchema,AdminRouteSafetyCommandSchema } from "@tikdd/admin-contracts";
import { AdminPlatformDiscardCommandSchema,AdminPlatformDraftCommandSchema,AdminPlatformPublishCommandSchema,AdminPlatformRollbackCommandSchema } from "@tikdd/admin-contracts";
import { AdminLocaleDiscardCommandSchema,AdminLocaleDraftCommandSchema,AdminPageDiscardCommandSchema,AdminPageDraftCommandSchema,AdminSharedContentDraftCommandSchema } from "@tikdd/admin-contracts";
import { AdminContentPublishCommandSchema,AdminContentRollbackCommandSchema,AdminContentRetryPropagationCommandSchema } from "@tikdd/admin-contracts";
import { AdminContentInvalidateCacheCommandSchema,AdminContentRebuildSnapshotCommandSchema } from "@tikdd/admin-contracts";
import { z } from "zod";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession,tokenFromRequest } from "../../../../lib/admin-auth-client";

export const dynamic = "force-dynamic";

function selectionFrom(request: NextRequest): AdminRouteSelection | undefined {
  const providerId = request.nextUrl.searchParams.get("provider");
  const platform = request.nextUrl.searchParams.get("platform");
  const region = request.nextUrl.searchParams.get("region");
  if (!providerId || !platform || !region) return undefined;
  if ([providerId, platform, region].some((value) => value.length > 100)) return undefined;
  return { providerId, platform, region };
}

function platformScopeFrom(request: NextRequest): string | undefined {
  const value = request.nextUrl.searchParams.get("policyPlatform");
  return value && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : undefined;
}

const responseHeaders = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff"
};

export async function GET(request: NextRequest) {
  if(!await getAdminSession(tokenFromRequest(request)))return NextResponse.json({error:{code:"UNAUTHORIZED"}},{status:401,headers:responseHeaders});
  const selection = selectionFrom(request);
  const policyPlatform = platformScopeFrom(request);
  const snapshot = await loadAdminConsoleSnapshot({
    requestHeaders: await headers(),
    ...(selection ? { selection } : {}),
    ...(policyPlatform ? { policyPlatform } : {}),
    ...(request.nextUrl.searchParams.get("managedPlatform") ? { managedPlatform: request.nextUrl.searchParams.get("managedPlatform")! } : {})
  });
  return NextResponse.json(snapshot, { headers: responseHeaders });
}

const CommandRequestSchema=z.discriminatedUnion("action",[
  z.strictObject({action:z.literal("draft"),csrfToken:z.string(),command:AdminRoutePolicyDraftCommandSchema}),
  z.strictObject({action:z.literal("publish"),csrfToken:z.string(),command:AdminRoutePolicyPublishCommandSchema}),
  z.strictObject({action:z.literal("discard"),csrfToken:z.string(),command:AdminRoutePolicyDiscardCommandSchema}),
  z.strictObject({action:z.literal("rollback"),csrfToken:z.string(),command:AdminRoutePolicyRollbackCommandSchema}),
  z.strictObject({action:z.literal("safety"),csrfToken:z.string(),command:AdminRouteSafetyCommandSchema}),
  z.strictObject({action:z.literal("probe"),csrfToken:z.string(),command:AdminRouteProbeCommandSchema})
  ,z.strictObject({action:z.literal("platform_draft"),csrfToken:z.string(),command:AdminPlatformDraftCommandSchema})
  ,z.strictObject({action:z.literal("platform_publish"),csrfToken:z.string(),command:AdminPlatformPublishCommandSchema})
  ,z.strictObject({action:z.literal("platform_discard"),csrfToken:z.string(),command:AdminPlatformDiscardCommandSchema})
  ,z.strictObject({action:z.literal("platform_rollback"),csrfToken:z.string(),command:AdminPlatformRollbackCommandSchema})
  ,z.strictObject({action:z.literal("locale_draft"),csrfToken:z.string(),command:AdminLocaleDraftCommandSchema})
  ,z.strictObject({action:z.literal("locale_discard"),csrfToken:z.string(),command:AdminLocaleDiscardCommandSchema})
  ,z.strictObject({action:z.literal("page_draft"),csrfToken:z.string(),command:AdminPageDraftCommandSchema})
  ,z.strictObject({action:z.literal("page_discard"),csrfToken:z.string(),command:AdminPageDiscardCommandSchema})
  ,z.strictObject({action:z.literal("shared_draft"),csrfToken:z.string(),command:AdminSharedContentDraftCommandSchema})
  ,z.strictObject({action:z.literal("content_publish"),csrfToken:z.string(),command:AdminContentPublishCommandSchema})
  ,z.strictObject({action:z.literal("content_rollback"),csrfToken:z.string(),command:AdminContentRollbackCommandSchema})
  ,z.strictObject({action:z.literal("content_retry"),csrfToken:z.string(),command:AdminContentRetryPropagationCommandSchema})
  ,z.strictObject({action:z.literal("recovery_rebuild"),csrfToken:z.string(),command:AdminContentRebuildSnapshotCommandSchema})
  ,z.strictObject({action:z.literal("recovery_invalidate"),csrfToken:z.string(),command:AdminContentInvalidateCacheCommandSchema})
]);

export async function POST(request:NextRequest) {
  if(!await getAdminSession(tokenFromRequest(request)))return NextResponse.json({error:{code:"UNAUTHORIZED"}},{status:401,headers:responseHeaders});
  const configuration=loadAdminApiConnection();
  if(request.headers.get("origin")!==configuration.adminOrigin||!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")){
    return NextResponse.json({error:{code:"ORIGIN_REJECTED",message:"The Admin command origin could not be verified."}},{status:403,headers:responseHeaders});
  }
  let parsed:z.infer<typeof CommandRequestSchema>;
  try{parsed=CommandRequestSchema.parse(await request.json());}catch{
    return NextResponse.json({error:{code:"INVALID_COMMAND",message:"Provide one bounded route-policy command."}},{status:400,headers:responseHeaders});
  }
  try{
    if(parsed.action.startsWith("recovery_")){
      const path=parsed.action==="recovery_rebuild"?"rebuild-snapshot":"invalidate-content-cache";
      const receipt=await sendAdminRecoveryCommand({requestHeaders:await headers(),path,csrfToken:parsed.csrfToken,command:parsed.command,configuration});
      return NextResponse.json(receipt,{headers:responseHeaders});
    }
    if(parsed.action.startsWith("platform_")){
      const path=parsed.action.slice("platform_".length) as "draft"|"publish"|"discard"|"rollback";
      const receipt=await sendAdminPlatformCommand({requestHeaders:await headers(),path,csrfToken:parsed.csrfToken,command:parsed.command,configuration});
      return NextResponse.json(receipt,{headers:responseHeaders});
    }
    if(parsed.action.startsWith("locale_")||parsed.action.startsWith("page_")||parsed.action==="shared_draft"||parsed.action.startsWith("content_")){
      const paths={locale_draft:"locales/draft",locale_discard:"locales/discard",page_draft:"pages/draft",page_discard:"pages/discard",shared_draft:"shared/draft",content_publish:"publish",content_rollback:"rollback",content_retry:"retry-propagation"} as const;
      const receipt=await sendAdminContentCommand({requestHeaders:await headers(),path:paths[parsed.action as keyof typeof paths],csrfToken:parsed.csrfToken,command:parsed.command,configuration});
      return NextResponse.json(receipt,{headers:responseHeaders});
    }
    const routeAction=parsed.action as "draft"|"publish"|"discard"|"rollback"|"safety"|"probe";
    const receipt=await sendAdminRouteCommand({requestHeaders:await headers(),path:routeAction,csrfToken:parsed.csrfToken,command:parsed.command,configuration});
    return NextResponse.json(receipt,{headers:responseHeaders});
  }catch{
    return NextResponse.json({error:{code:"COMMAND_REJECTED",message:"Reload the current revision before retrying."}},{status:409,headers:responseHeaders});
  }
}
