"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, clearSession } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  if (!identifier || !password) return { error: "Enter your email/mobile and password." };

  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { phone: identifier }] },
    include: { client: true },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Incorrect email/mobile or password." };
  }
  if (user.status === "DISABLED" || (user.client && user.client.status === "DISABLED")) {
    return { error: "This account is disabled. Contact the administrator." };
  }

  await createSession({
    uid: user.id,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
  });
  redirect(user.role === "ADMIN" ? "/admin/dashboard" : "/client/dashboard");
}

export async function logout() {
  clearSession();
  redirect("/login");
}
