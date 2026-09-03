"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireClient } from "@/lib/auth";
import { nextPaymentId, nextTransactionId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { PaymentMethod, Prisma } from "@prisma/client";

export type PaymentFormState = { error?: string; success?: string } | undefined;

const MAX_SCREENSHOT = 3 * 1024 * 1024;

export async function submitPayment(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const session = await requireClient();

  const amount = Number(String(formData.get("amount") ?? "").trim());
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid amount." };
  if (amount > 10_000_000) return { error: "Amount is too large." };

  const method = String(formData.get("paymentMethod") ?? "") as PaymentMethod;
  if (!Object.values(PaymentMethod).includes(method)) return { error: "Select a payment method." };

  const utr = String(formData.get("utrNumber") ?? "").trim();
  if (utr.length < 6) return { error: "Enter the UTR / transaction number from your payment." };

  const dateStr = String(formData.get("paymentDate") ?? "").trim();
  const paymentDate = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(paymentDate.getTime())) return { error: "Enter a valid payment date." };

  let screenshot: Buffer | null = null;
  let screenshotMime: string | null = null;
  const file = formData.get("screenshot");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_SCREENSHOT) return { error: "Screenshot must be under 3 MB." };
    if (!file.type.startsWith("image/")) return { error: "Screenshot must be an image file." };
    screenshot = Buffer.from(await file.arrayBuffer());
    screenshotMime = file.type;
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          paymentId: await nextPaymentId(tx),
          clientId: session.clientId,
          amount,
          paymentMethod: method,
          utrNumber: utr,
          paymentDate,
          screenshot,
          screenshotMime,
          status: "PENDING",
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A payment with this UTR number has already been submitted." };
    }
    return { error: "Payment could not be submitted. Please try again." };
  }

  revalidatePath("/client/payments");
  return { success: "Payment submitted. Status: Pending Verification. Your balance will update once the admin approves it." };
}

export async function approvePayment(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await db.$transaction(async (tx) => {
    // Guard against double-approval: only flips PENDING -> APPROVED once.
    const updated = await tx.payment.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "APPROVED", approvedBy: session.uid, approvedAt: new Date() },
    });
    if (updated.count !== 1) return;

    const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
    const client = await tx.client.update({
      where: { id: payment.clientId },
      data: { balance: { increment: payment.amount } },
    });
    await tx.transaction.create({
      data: {
        transactionId: await nextTransactionId(tx),
        clientId: payment.clientId,
        transactionType: "PAYMENT_RECEIVED",
        amount: payment.amount,
        balanceAfter: client.balance,
        referenceId: payment.paymentId,
        description: `Payment ${payment.paymentId} approved (${payment.paymentMethod === "UPI" ? "UPI" : "Bank transfer"}, UTR ${payment.utrNumber})`,
        createdBy: session.uid,
      },
    });
    await logAudit(tx, session, "PAYMENT_APPROVED", "payment", payment.paymentId, `Amount ${payment.amount}`);
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/dashboard");
}

export async function rejectPayment(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect("/admin/payments?error=reason");

  await db.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", rejectionReason: reason, approvedBy: session.uid, approvedAt: new Date() },
    });
    if (updated.count !== 1) return;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
    await logAudit(tx, session, "PAYMENT_REJECTED", "payment", payment.paymentId, reason);
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/dashboard");
}
