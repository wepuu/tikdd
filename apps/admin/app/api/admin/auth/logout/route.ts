import { NextRequest, NextResponse } from "next/server";
import { cookieName, logoutAdmin, tokenFromRequest } from "../../../../../lib/admin-auth-client";

export async function POST(request: NextRequest) {
  const trusted = request.headers.get("origin") === (process.env.ADMIN_ORIGIN ?? "http://localhost:3001")
    && request.headers.get("content-type")?.startsWith("application/json") === true;
  if (!trusted) return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  const allDevices = (await request.json().catch(() => ({})))?.allDevices === true;
  await logoutAdmin(tokenFromRequest(request), allDevices).catch(() => null);
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
