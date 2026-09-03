"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { calculateCharges, Quote } from "@/lib/pricing";
import { nextBookingId, nextTransactionId } from "@/lib/ids";
import { num } from "@/lib/money";
import { ShipmentType } from "@prisma/client";

export type QuoteState = { quote?: Quote; balance?: number; error?: string };

export async function getQuote(serviceId: string, weight: number): Promise<QuoteState> {
  try {
    const session = await requireClient();
    const quote = await calculateCharges(serviceId, weight);
    const client = await db.client.findUnique({ where: { id: session.clientId } });
    return { quote, balance: client ? num(client.balance) : 0 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not calculate charges" };
  }
}

export type BookingFormState = { error?: string } | undefined;

const REQUIRED = [
  "senderName", "senderMobile", "senderAddress", "senderCity", "senderState", "senderPin",
  "receiverName", "receiverMobile", "receiverAddress", "receiverCity", "receiverState", "receiverPin",
] as const;

const FIELD_LABELS: Record<string, string> = {
  senderName: "Sender name", senderMobile: "Sender mobile", senderAddress: "Sender address",
  senderCity: "Sender city", senderState: "Sender state", senderPin: "Sender PIN code",
  receiverName: "Receiver name", receiverMobile: "Receiver mobile", receiverAddress: "Receiver address",
  receiverCity: "Receiver city", receiverState: "Receiver state", receiverPin: "Receiver PIN code",
};

export async function createBooking(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const session = await requireClient();

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const optNum = (k: string) => {
    const v = get(k);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  for (const f of REQUIRED) {
    if (!get(f)) return { error: `${FIELD_LABELS[f]} is required.` };
  }
  for (const f of ["senderMobile", "receiverMobile"]) {
    if (!/^[0-9+\-\s]{10,15}$/.test(get(f))) return { error: `${FIELD_LABELS[f]} looks invalid.` };
  }
  for (const f of ["senderPin", "receiverPin"]) {
    if (!/^\d{6}$/.test(get(f))) return { error: `${FIELD_LABELS[f]} must be 6 digits.` };
  }

  const shipmentType = get("shipmentType") as ShipmentType;
  if (!Object.values(ShipmentType).includes(shipmentType)) return { error: "Select a shipment type." };
  const serviceId = get("serviceId");
  if (!serviceId) return { error: "Select a service." };
  const weight = Number(get("weight"));
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) return { error: "Enter a valid weight in kg." };
  const quantity = Math.max(1, Math.floor(Number(get("quantity") || 1)));
  const bookingDateStr = get("bookingDate");
  const bookingDate = bookingDateStr ? new Date(bookingDateStr) : new Date();
  if (isNaN(bookingDate.getTime())) return { error: "Enter a valid booking date." };

  // Server-side price calculation - browser-supplied amounts are ignored.
  let quote: Quote;
  try {
    quote = await calculateCharges(serviceId, weight);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not calculate charges" };
  }

  let newBookingRef = "";
  try {
    await db.$transaction(async (tx) => {
      // Conditional decrement guards against races and insufficient balance.
      const updated = await tx.client.updateMany({
        where: { id: session.clientId, status: "ACTIVE", balance: { gte: quote.total } },
        data: { balance: { decrement: quote.total } },
      });
      if (updated.count !== 1) {
        const client = await tx.client.findUnique({ where: { id: session.clientId } });
        const available = client ? num(client.balance) : 0;
        throw new Error(
          `INSUFFICIENT|${quote.total.toFixed(2)}|${available.toFixed(2)}`
        );
      }
      const client = await tx.client.findUniqueOrThrow({ where: { id: session.clientId } });
      const bookingId = await nextBookingId(tx);
      const booking = await tx.booking.create({
        data: {
          bookingId,
          clientId: session.clientId,
          senderName: get("senderName"),
          senderCompany: get("senderCompany") || null,
          senderMobile: get("senderMobile"),
          senderAddress: get("senderAddress"),
          senderCity: get("senderCity"),
          senderState: get("senderState"),
          senderPin: get("senderPin"),
          receiverName: get("receiverName"),
          receiverCompany: get("receiverCompany") || null,
          receiverMobile: get("receiverMobile"),
          receiverAddress: get("receiverAddress"),
          receiverCity: get("receiverCity"),
          receiverState: get("receiverState"),
          receiverPin: get("receiverPin"),
          shipmentType,
          serviceId,
          weight,
          quantity,
          length: optNum("length"),
          width: optNum("width"),
          height: optNum("height"),
          description: get("description") || null,
          bookingDate,
          baseCharge: quote.baseCharge,
          additionalCharge: quote.additionalCharge,
          gst: quote.gst,
          totalAmount: quote.total,
          bookingStatus: "BOOKED",
          paymentStatus: "Paid from balance",
        },
      });
      await tx.transaction.create({
        data: {
          transactionId: await nextTransactionId(tx),
          clientId: session.clientId,
          transactionType: "BOOKING_DEDUCTION",
          amount: -quote.total,
          balanceAfter: client.balance,
          referenceId: bookingId,
          description: `Booking ${bookingId} - ${quote.serviceName}, ${weight} kg`,
          createdBy: session.uid,
        },
      });
      newBookingRef = booking.id;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("INSUFFICIENT|")) {
      const [, required, available] = msg.split("|");
      const shortfall = (Number(required) - Number(available)).toFixed(2);
      return {
        error: `Insufficient balance. Required \u20B9${required}, available \u20B9${available}, shortfall \u20B9${shortfall}. Add money to continue.`,
      };
    }
    return { error: "Booking could not be created. Please try again." };
  }

  revalidatePath("/client", "layout");
  redirect(`/client/bookings/${newBookingRef}?created=1`);
}
