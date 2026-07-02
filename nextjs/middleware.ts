import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/login") {
    const token = searchParams.get("token");

    if (token) {
      const queryRedirect = searchParams.get("redirect");
      const cookieRedirect = request.cookies.get("oauth_redirect")?.value;
      const redirectTo = queryRedirect || (cookieRedirect ? decodeURIComponent(cookieRedirect) : "/embed");

      const url = new URL(redirectTo, request.url);
      const response = NextResponse.redirect(url);
      response.cookies.set("auth_token", token, {
        path: "/",
        maxAge: 30 * 86400, // 30일
        sameSite: "lax",
      });
      response.cookies.delete("oauth_redirect");
      return response;
    }
  }
}

export const config = {
  matcher: "/login",
};
