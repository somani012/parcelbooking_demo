import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

const COOKIE = "portal_session";

export type Session = {
  uid: string;
  name: string;
  role: "ADMIN" | "CLIENT";
  clientId: string | null;
};

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
}

export async function createSession(s: Session) {
  const token = await new SignJWT(s)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireClient(): Promise<Session & { clientId: string }> {
  const s = await getSession();
  if (!s || s.role !== "CLIENT" || !s.clientId) redirect("/login");
  return s as Session & { clientId: string };
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") redirect("/login");
  return s;
}

export const SESSION_COOKIE = COOKIE;
