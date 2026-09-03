import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "portal_session";

async function readSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
    const { payload } = await jwtVerify(token, secret);
    return payload as { role?: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req);

  // Role-based access control: URLs alone can never cross the role boundary.
  if (pathname.startsWith("/admin") || pathname.startsWith("/client")) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/client/dashboard", req.url));
    }
    if (pathname.startsWith("/client") && session.role !== "CLIENT") {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
  }
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin/dashboard" : "/client/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/client/:path*", "/login"] };
