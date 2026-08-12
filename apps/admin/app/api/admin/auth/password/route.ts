import { AdminPasswordChangeRequestSchema } from "@tikdd/admin-contracts";
import { NextRequest, NextResponse } from "next/server";
import { changeAdminPassword, cookieName, tokenFromRequest } from "../../../../../lib/admin-auth-client";

export async function POST(request: NextRequest) {
  const trusted = request.headers.get("origin") === (process.env.ADMIN_ORIGIN ?? "http://localhost:3001")
    && request.headers.get("content-type")?.startsWith("application/json") === true;
  if (!trusted) return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  const parsed = AdminPasswordChangeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "密码字段不符合要求" }, { status: 400 });
  const upstream = await changeAdminPassword(tokenFromRequest(request), parsed.data);
  if (!upstream.ok) return NextResponse.json({ error: "当前密码不正确或认证服务不可用" }, { status: upstream.status });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName(), "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
