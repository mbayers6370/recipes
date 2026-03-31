import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenEdge, ACCESS_COOKIE } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/offline",
  "/shared",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/refresh",
  "/api/shared-recipes",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths, static assets, and Next.js internals
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "?")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname === "/sw.js" ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|woff2?)$/) != null;

  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await verifyAccessTokenEdge(token);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Token expired" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    const resp = NextResponse.redirect(loginUrl);
    resp.cookies.delete(ACCESS_COOKIE);
    return resp;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest|icon|apple-icon|sw\\.js).*)"],
};
