import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/login") {
    const token = searchParams.get("token");

    if (token) {
      const redirectTo = searchParams.get("redirect") || "/embed";
      const url = new URL(redirectTo, request.url);
      const response = NextResponse.redirect(url);
      response.cookies.set("auth_token", token, {
        path: "/",
        maxAge: 30 * 86400, // 30일
        sameSite: "lax",
      });
      return response;
    }
  }
}

export const config = {
  matcher: "/login",
};
