import { AdminLoginRequestSchema } from "@tikdd/admin-contracts";
import { NextRequest, NextResponse } from "next/server";
import { cookieName, loginAdmin } from "../../../../../lib/admin-auth-client";

export async function POST(request: NextRequest) {
  const expectedOrigin = process.env.ADMIN_ORIGIN ?? "http://localhost:3001";
  if (request.headers.get("origin") !== expectedOrigin || !request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  }
  const parsed = AdminLoginRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请输入有效的用户名和密码" }, { status: 400 });

  try {
    const result = await loginAdmin(parsed.data);
    if (!result.ok) {
      const message = result.status === 429
        ? "登录尝试过多，请稍后再试"
        : result.status === 401
          ? "用户名或密码不正确"
          : "认证服务暂不可用，请检查 Admin API、Postgres 与 Redis";
      return NextResponse.json({ error: message }, {
        status: result.status,
        headers: result.retryAfter ? { "Retry-After": result.retryAfter } : {}
      });
    }

    const response = NextResponse.json({ session: result.data!.session });
    response.cookies.set(cookieName(), result.data!.sessionToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(result.data!.session.expiresAt)
    });
    return response;
  } catch {
    return NextResponse.json({ error: "认证服务暂不可用，请检查 Admin API、Postgres 与 Redis" }, { status: 503 });
  }
}
