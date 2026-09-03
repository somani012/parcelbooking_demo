import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Diagnostic endpoint: reports whether required env vars are present and
// whether the database is reachable. Never echoes secret values.
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_REGION: process.env.VERCEL_REGION ?? null,
  };

  let database: { ok: true; users: number } | { ok: false; error: string };
  try {
    const users = await db.user.count();
    database = { ok: true, users };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Strip anything that looks like a connection string before returning.
    database = { ok: false, error: msg.replace(/postgres(ql)?:\/\/\S+/gi, "postgresql://***").slice(0, 600) };
  }

  return NextResponse.json({ env, database }, { status: database.ok ? 200 : 500 });
}
