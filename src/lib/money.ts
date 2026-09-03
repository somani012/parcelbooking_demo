import { Prisma } from "@prisma/client";

export function inr(value: Prisma.Decimal | number | string): string {
  const n = typeof value === "object" ? Number(value.toString()) : Number(value);
  return "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function num(value: Prisma.Decimal | number | string): number {
  return typeof value === "object" ? Number(value.toString()) : Number(value);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", BOOKED: "Booked", PROCESSING: "Processing", DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit", DELIVERED: "Delivered", CANCELLED: "Cancelled",
  PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected",
  DOCUMENT: "Document", PARCEL: "Parcel", LETTER: "Letter", OTHER: "Other",
  PAYMENT_RECEIVED: "Payment Received", BOOKING_DEDUCTION: "Booking Deduction",
  REFUND: "Refund", MANUAL_CREDIT: "Manual Credit", MANUAL_DEBIT: "Manual Debit",
  UPI: "UPI", BANK_TRANSFER: "Bank Transfer", ACTIVE: "Active", DISABLED: "Disabled",
};

export function label(v: string | null | undefined): string {
  if (!v) return "-";
  return STATUS_LABEL[v] ?? v;
}
