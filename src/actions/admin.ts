"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { nextClientCode, nextTransactionId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { BookingStatus, Prisma } from "@prisma/client";

export type AdminFormState = { error?: string; success?: string } | undefined;

// ---------- Clients ----------

export async function createClient(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const required = ["companyName", "contactPerson", "email", "phone", "address", "city", "state", "pinCode", "password"];
  for (const f of required) if (!get(f)) return { error: "Fill in all required fields." };
  if (get("password").length < 6) return { error: "Password must be at least 6 characters." };
  if (!/^\d{6}$/.test(get("pinCode"))) return { error: "PIN code must be 6 digits." };

  try {
    await db.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          clientCode: await nextClientCode(tx),
          companyName: get("companyName"),
          contactPerson: get("contactPerson"),
          email: get("email").toLowerCase(),
          phone: get("phone"),
          address: get("address"),
          city: get("city"),
          state: get("state"),
          pinCode: get("pinCode"),
          gstNumber: get("gstNumber") || null,
        },
      });
      await tx.user.create({
        data: {
          name: get("contactPerson"),
          email: get("email").toLowerCase(),
          phone: get("phone"),
          passwordHash: await bcrypt.hash(get("password"), 10),
          role: "CLIENT",
          clientId: client.id,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A client with this email or phone already exists." };
    }
    return { error: "Client could not be created." };
  }
  revalidatePath("/admin/clients");
  return { success: "Client created. Share the login email and password with them." };
}

export async function updateClient(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const id = get("id");
  if (!id) return { error: "Missing client." };
  try {
    await db.client.update({
      where: { id },
      data: {
        companyName: get("companyName"),
        contactPerson: get("contactPerson"),
        phone: get("phone"),
        address: get("address"),
        city: get("city"),
        state: get("state"),
        pinCode: get("pinCode"),
        gstNumber: get("gstNumber") || null,
      },
    });
  } catch {
    return { error: "Client could not be updated." };
  }
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/clients");
  return { success: "Client details saved." };
}

export async function toggleClientStatus(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const client = await db.client.findUnique({ where: { id } });
  if (!client) return;
  const status = client.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
  await db.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { status } });
    await logAudit(tx, session, status === "DISABLED" ? "CLIENT_DISABLED" : "CLIENT_ENABLED", "client", client.clientCode);
  });
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
}

export async function resetClientPassword(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  const user = await db.user.findFirst({ where: { clientId: id, role: "CLIENT" } });
  if (!user) return { error: "No login user found for this client." };
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    await logAudit(tx, session, "PASSWORD_RESET", "user", user.email);
  });
  return { success: "Password reset. Share the new password with the client." };
}

// ---------- Manual balance adjustment ----------

export async function manualAdjustment(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const session = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const type = String(formData.get("type") ?? "");
  const amount = Number(String(formData.get("amount") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  if (!clientId || !["MANUAL_CREDIT", "MANUAL_DEBIT"].includes(type)) return { error: "Invalid adjustment." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid amount." };
  if (!description) return { error: "A reason is required for manual adjustments." };

  try {
    await db.$transaction(async (tx) => {
      if (type === "MANUAL_DEBIT") {
        const updated = await tx.client.updateMany({
          where: { id: clientId, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });
        if (updated.count !== 1) throw new Error("BALANCE");
      } else {
        await tx.client.update({ where: { id: clientId }, data: { balance: { increment: amount } } });
      }
      const client = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
      await tx.transaction.create({
        data: {
          transactionId: await nextTransactionId(tx),
          clientId,
          transactionType: type as "MANUAL_CREDIT" | "MANUAL_DEBIT",
          amount: type === "MANUAL_DEBIT" ? -amount : amount,
          balanceAfter: client.balance,
          description,
          createdBy: session.uid,
        },
      });
      await logAudit(tx, session, type, "client", client.clientCode, `${description} (${amount})`);
    });
  } catch (e) {
    if (e instanceof Error && e.message === "BALANCE") return { error: "Client balance is lower than the debit amount." };
    return { error: "Adjustment failed." };
  }
  revalidatePath(`/admin/clients/${clientId}`);
  return { success: "Balance adjusted and recorded in the ledger." };
}

// ---------- Bookings ----------

export async function updateBookingStatus(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as BookingStatus;
  const tracking = String(formData.get("trackingNumber") ?? "").trim();
  if (!Object.values(BookingStatus).includes(status)) return;
  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking || booking.bookingStatus === "CANCELLED") return;

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { bookingStatus: status, trackingNumber: tracking || null },
    });
    if (booking.bookingStatus !== status) {
      await logAudit(tx, session, "BOOKING_STATUS_CHANGED", "booking", booking.bookingId, `${booking.bookingStatus} -> ${status}`);
    }
    if ((booking.trackingNumber || "") !== tracking) {
      await logAudit(tx, session, "TRACKING_UPDATED", "booking", booking.bookingId, tracking || "(cleared)");
    }
  });
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
}

export async function cancelBooking(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await db.$transaction(async (tx) => {
    // Only bookings that are not delivered/cancelled can be cancelled; refund goes back to balance.
    const updated = await tx.booking.updateMany({
      where: { id, bookingStatus: { notIn: ["DELIVERED", "CANCELLED"] } },
      data: { bookingStatus: "CANCELLED", paymentStatus: "Refunded to balance" },
    });
    if (updated.count !== 1) return;
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    const client = await tx.client.update({
      where: { id: booking.clientId },
      data: { balance: { increment: booking.totalAmount } },
    });
    await tx.transaction.create({
      data: {
        transactionId: await nextTransactionId(tx),
        clientId: booking.clientId,
        transactionType: "REFUND",
        amount: booking.totalAmount,
        balanceAfter: client.balance,
        referenceId: booking.bookingId,
        description: `Refund for cancelled booking ${booking.bookingId}`,
        createdBy: session.uid,
      },
    });
    await logAudit(tx, session, "BOOKING_CANCELLED", "booking", booking.bookingId, `Refund ${booking.totalAmount}`);
  });
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
}

// ---------- Services & pricing ----------

export async function saveService(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return { error: "Service name is required." };
  try {
    if (id) await db.service.update({ where: { id }, data: { name, description } });
    else await db.service.create({ data: { name, description } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A service with this name already exists." };
    }
    return { error: "Service could not be saved." };
  }
  revalidatePath("/admin/services");
  revalidatePath("/admin/pricing");
  return { success: id ? "Service updated." : "Service added." };
}

export async function toggleService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const service = await db.service.findUnique({ where: { id } });
  if (!service) return;
  await db.service.update({
    where: { id },
    data: { status: service.status === "ACTIVE" ? "DISABLED" : "ACTIVE" },
  });
  revalidatePath("/admin/services");
}

export async function savePricingRule(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const serviceId = String(formData.get("serviceId") ?? "");
  const min = Number(String(formData.get("minimumWeight") ?? ""));
  const max = Number(String(formData.get("maximumWeight") ?? ""));
  const base = Number(String(formData.get("basePrice") ?? ""));
  const additional = Number(String(formData.get("additionalPrice") ?? "0"));
  if (!serviceId) return { error: "Select a service." };
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min) {
    return { error: "Weight range is invalid (maximum must be greater than minimum)." };
  }
  if (!Number.isFinite(base) || base <= 0) return { error: "Enter a valid base price." };
  if (!Number.isFinite(additional) || additional < 0) return { error: "Additional price cannot be negative." };
  await db.pricingRule.create({
    data: { serviceId, minimumWeight: min, maximumWeight: max, basePrice: base, additionalPrice: additional },
  });
  revalidatePath("/admin/pricing");
  return { success: "Pricing rule added." };
}

export async function deletePricingRule(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await db.pricingRule.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/pricing");
}

// ---------- Company settings ----------

export async function saveSettings(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const gstPercent = Number(get("gstPercent") || "18");
  if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
    return { error: "GST % must be between 0 and 100." };
  }

  let logo: Buffer | undefined;
  let logoMime: string | undefined;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1024 * 1024) return { error: "Logo must be under 1 MB." };
    if (!["image/png", "image/jpeg"].includes(file.type)) return { error: "Logo must be a PNG or JPEG." };
    logo = Buffer.from(await file.arrayBuffer());
    logoMime = file.type;
  }

  await db.companySettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {
      companyName: get("companyName") || "My Company",
      address: get("address"),
      phone: get("phone"),
      email: get("email"),
      gstNumber: get("gstNumber") || null,
      gstPercent,
      upiId: get("upiId"),
      bankName: get("bankName"),
      accountName: get("accountName"),
      accountNumber: get("accountNumber"),
      ifsc: get("ifsc"),
      branch: get("branch"),
      terms: get("terms"),
      ...(logo ? { logo, logoMime } : {}),
    },
  });
  revalidatePath("/admin/settings");
  return { success: "Settings saved. They will appear on payment pages and booking slips." };
}
