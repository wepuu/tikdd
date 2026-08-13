import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadAdminAuthConnection } from "../lib/admin-auth-client";

const production:NodeJS.ProcessEnv={NODE_ENV:"production",ADMIN_API_INTERNAL_ORIGIN:"http://127.0.0.1:4100",ADMIN_ORIGIN:"https://admin.tikdd.example",ADMIN_ORIGIN_PROOF:"origin-proof-with-at-least-32-characters"};

describe("work item 12 Admin baseline",()=>{
  it("fails the production authentication BFF closed when origin configuration is incomplete",()=>{
    expect(loadAdminAuthConnection(production)).toEqual({origin:"http://127.0.0.1:4100",admin:"https://admin.tikdd.example",proof:production.ADMIN_ORIGIN_PROOF});
    expect(()=>loadAdminAuthConnection({...production,ADMIN_ORIGIN_PROOF:undefined})).toThrow(/ORIGIN_PROOF/);
    expect(()=>loadAdminAuthConnection({...production,ADMIN_API_INTERNAL_ORIGIN:"https://admin-api.example"})).toThrow(/loopback/);
    expect(()=>loadAdminAuthConnection({...production,ADMIN_ORIGIN:"http://admin.tikdd.example"})).toThrow(/HTTPS/);
  });

  it("keeps the session cookie opaque and the whole Admin surface private",async()=>{
    const [login,headers]=await Promise.all([
      readFile(new URL("../app/api/admin/auth/login/route.ts",import.meta.url),"utf8"),
      readFile(new URL("../next.config.ts",import.meta.url),"utf8")
    ]);
    expect(login).toContain("httpOnly: true");expect(login).toContain('sameSite: "strict"');expect(login).toContain('secure: process.env.NODE_ENV === "production"');
    expect(login).toContain("{ session: result.data!.session }");expect(login).not.toContain("sessionToken: result.data");
    expect(headers).toContain('value: "no-store"');expect(headers).toContain("noindex, nofollow, noarchive");expect(headers).toContain("frame-ancestors 'none'");
  });

  it("retains responsive, keyboard-focus, and reduced-motion safeguards with reviewed mobile evidence",async()=>{
    const [css,consoleSource,qa]=await Promise.all([
      readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
      readFile(new URL("../components/admin-console.tsx",import.meta.url),"utf8"),
      readFile(new URL("../../../docs/design/work-item-12-9-1-design-qa.md",import.meta.url),"utf8")
    ]);
    expect(css).toMatch(/:focus-visible/);expect(css).toMatch(/prefers-reduced-motion/);expect(css).toContain("@media(max-width:680px)");
    expect(consoleSource).toContain("aria-label");expect(qa).toContain("390 × 844");expect(qa).toContain("no page-level horizontal overflow");
  });
});
