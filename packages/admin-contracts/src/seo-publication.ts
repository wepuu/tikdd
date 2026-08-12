import { z } from "zod";
import { AdminSchemaVersionSchema } from "./common";
import { LocaleTagSchema, type PublishedContentSnapshot } from "./editorial";

export const AdminSeoBlockerSchema=z.enum([
  "revision_not_ready","reserved_private_path","path_collision","redirect_collision","redirect_chain",
  "redirect_loop","slug_migration_missing","platform_not_eligible","fallback_not_indexable","sitemap_conflict"
]);
export const AdminSeoPassportSchema=z.strictObject({
  schemaVersion:AdminSchemaVersionSchema,
  pageId:z.string().regex(/^page_[a-z0-9]+(?:[._-][a-z0-9]+)*$/),locale:LocaleTagSchema,
  canonicalPath:z.string().regex(/^\/[A-Za-z0-9/_-]*$/),hreflang:z.array(z.strictObject({locale:LocaleTagSchema,path:z.string().regex(/^\/[A-Za-z0-9/_-]*$/)})).max(100),
  search:z.strictObject({title:z.string().max(70),description:z.string().max(180)}),
  social:z.strictObject({title:z.string().max(100),description:z.string().max(240),imageAssetId:z.string().nullable()}),
  sitemapEligible:z.boolean(),indexableEligible:z.boolean(),structuredDataTemplate:z.enum(["WebSite","FAQPage","TechArticle","WebPage"]),
  redirects:z.array(z.strictObject({from:z.string().regex(/^\/[A-Za-z0-9/_-]*$/),to:z.string().regex(/^\/[A-Za-z0-9/_-]*$/)})).max(20),
  blockers:z.array(AdminSeoBlockerSchema).max(20)
});
export const AdminSeoTechnicalViewSchema=z.strictObject({
  schemaVersion:AdminSchemaVersionSchema,generatedAt:z.iso.datetime({offset:true}),privateRoutePrefixes:z.array(z.string().regex(/^\/[a-z0-9/-]+$/)).max(20),
  passports:z.array(AdminSeoPassportSchema).max(10_000),sitemapPaths:z.array(z.string().regex(/^\/[A-Za-z0-9/_-]*$/)).max(10_000),
  blockerCount:z.number().int().nonnegative().max(100_000)
});

const PRIVATE_PREFIXES=["/admin","/api","/tasks","/results","/delivery","/internal","/tickets","/candidates","/objects"] as const;
const localized=(locale:string,path:string)=>`/${locale}${path==="/"?"":path}`;
const privatePath=(path:string)=>PRIVATE_PREFIXES.some(prefix=>path===prefix||path.startsWith(`${prefix}/`));
export function deriveSeoTechnicalView(input:{snapshot:PublishedContentSnapshot;activeSnapshot?:PublishedContentSnapshot|null;eligiblePlatforms:readonly string[];generatedAt:string}){
  const snapshot=input.snapshot;const eligible=new Set(input.eligiblePlatforms);const blockersByKey=new Map<string,Set<z.infer<typeof AdminSeoBlockerSchema>>>();
  const add=(pageId:string,locale:string,blocker:z.infer<typeof AdminSeoBlockerSchema>)=>{const key=`${pageId}/${locale}`;const set=blockersByKey.get(key)??new Set();set.add(blocker);blockersByKey.set(key,set);};
  const targets=new Map<string,string>();const redirects=new Map<string,string>();
  for(const page of snapshot.pages){const target=localized(page.locale,page.seo.localPath);if(privatePath(page.seo.localPath))add(page.pageId,page.locale,"reserved_private_path");if(targets.has(target))add(page.pageId,page.locale,"path_collision");targets.set(target,`${page.pageId}/${page.locale}`);for(const fromPath of page.seo.redirectFrom){const from=localized(page.locale,fromPath);if(privatePath(fromPath))add(page.pageId,page.locale,"reserved_private_path");if(redirects.has(from)||targets.has(from))add(page.pageId,page.locale,"redirect_collision");redirects.set(from,target);}}
  for(const page of snapshot.pages){const key=`${page.pageId}/${page.locale}`;const target=localized(page.locale,page.seo.localPath);for(const fromPath of page.seo.redirectFrom){const from=localized(page.locale,fromPath);if(redirects.get(target))add(page.pageId,page.locale,"redirect_chain");let cursor=target;const seen=new Set([from]);while(redirects.has(cursor)){if(seen.has(cursor)){add(page.pageId,page.locale,"redirect_loop");break;}seen.add(cursor);cursor=redirects.get(cursor)!;}}
    const prior=input.activeSnapshot?.pages.find(item=>item.pageId===page.pageId&&item.locale===page.locale);if(prior&&prior.seo.localPath!==page.seo.localPath&&!page.seo.redirectFrom.includes(prior.seo.localPath))add(page.pageId,page.locale,"slug_migration_missing");
    if(page.pageType==="platform"&&(!page.platform||!eligible.has(page.platform)))add(page.pageId,page.locale,"platform_not_eligible");if(page.seo.includeInSitemap&&!page.seo.indexable)add(page.pageId,page.locale,"sitemap_conflict");blockersByKey.set(key,blockersByKey.get(key)??new Set());}
  const passports=snapshot.pages.map(page=>{const key=`${page.pageId}/${page.locale}`;const group=snapshot.pages.filter(item=>item.pageId===page.pageId&&item.seo.indexable&&!blockersByKey.get(`${item.pageId}/${item.locale}`)?.size);const blockers=[...(blockersByKey.get(key)??[])];const indexableEligible=page.seo.indexable&&blockers.length===0;return{schemaVersion:"1" as const,pageId:page.pageId,locale:page.locale,canonicalPath:localized(page.locale,page.seo.localPath),hreflang:indexableEligible?group.map(item=>({locale:item.locale,path:localized(item.locale,item.seo.localPath)})):[],search:{title:page.seo.searchTitle,description:page.seo.searchDescription},social:{title:page.seo.socialTitle??page.seo.searchTitle,description:page.seo.socialDescription??page.seo.searchDescription,imageAssetId:page.seo.socialImageAssetId},sitemapEligible:indexableEligible&&page.seo.includeInSitemap,indexableEligible,structuredDataTemplate:page.pageType==="homepage"?"WebSite":page.pageType==="faq"?"FAQPage":page.pageType==="guide"?"TechArticle":"WebPage",redirects:page.seo.redirectFrom.map(from=>({from:localized(page.locale,from),to:localized(page.locale,page.seo.localPath)})),blockers};});
  return AdminSeoTechnicalViewSchema.parse({schemaVersion:"1",generatedAt:input.generatedAt,privateRoutePrefixes:PRIVATE_PREFIXES,passports,sitemapPaths:passports.filter(item=>item.sitemapEligible).map(item=>item.canonicalPath).sort(),blockerCount:passports.reduce((sum,item)=>sum+item.blockers.length,0)});
}
export type AdminSeoTechnicalView=z.infer<typeof AdminSeoTechnicalViewSchema>;
