"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFormState } from "react-dom";
import { createBooking, getQuote } from "@/actions/bookings";
import type { Quote } from "@/lib/pricing";
import { SubmitButton } from "@/components/SubmitButton";

const SHIPMENT_TYPES = [
  { value: "DOCUMENT", label: "Document" },
  { value: "PARCEL", label: "Parcel" },
  { value: "LETTER", label: "Letter" },
  { value: "OTHER", label: "Other" },
];

const rupee = (n: number) =>
  "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  services: { id: string; name: string }[];
  balance: number;
  senderDefaults: Record<string, string>;
};

export function BookingForm({ services, balance, senderDefaults }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [liveBalance, setLiveBalance] = useState(balance);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [shipmentType, setShipmentType] = useState("DOCUMENT");
  const [state, action] = useFormState(createBooking, undefined);
  const today = new Date().toISOString().slice(0, 10);

  async function reviewBooking() {
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    setQuoting(true);
    setQuoteError(null);
    const result = await getQuote(String(data.get("serviceId")), Number(data.get("weight")));
    setQuoting(false);
    if (result.error || !result.quote) {
      setQuoteError(result.error ?? "Could not calculate charges");
      return;
    }
    setQuote(result.quote);
    if (typeof result.balance === "number") setLiveBalance(result.balance);
    setStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const insufficient = quote ? liveBalance < quote.total : false;

  return (
    <form ref={formRef} action={action} className="max-w-3xl">
      {/* ---- Step 1: details (kept mounted so values survive the confirm step) ---- */}
      <div className={step === "form" ? "space-y-4" : "hidden"}>
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold">Sender details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="senderName">Name *</label><input id="senderName" name="senderName" defaultValue={senderDefaults.senderName} required /></div>
            <div><label htmlFor="senderCompany">Company</label><input id="senderCompany" name="senderCompany" defaultValue={senderDefaults.senderCompany} /></div>
            <div><label htmlFor="senderMobile">Mobile *</label><input id="senderMobile" name="senderMobile" inputMode="tel" defaultValue={senderDefaults.senderMobile} required /></div>
            <div className="sm:col-span-2"><label htmlFor="senderAddress">Address *</label><input id="senderAddress" name="senderAddress" defaultValue={senderDefaults.senderAddress} required /></div>
            <div><label htmlFor="senderCity">City *</label><input id="senderCity" name="senderCity" defaultValue={senderDefaults.senderCity} required /></div>
            <div><label htmlFor="senderState">State *</label><input id="senderState" name="senderState" defaultValue={senderDefaults.senderState} required /></div>
            <div><label htmlFor="senderPin">PIN code *</label><input id="senderPin" name="senderPin" inputMode="numeric" pattern="\d{6}" defaultValue={senderDefaults.senderPin} required /></div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold">Receiver details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="receiverName">Name *</label><input id="receiverName" name="receiverName" required /></div>
            <div><label htmlFor="receiverCompany">Company</label><input id="receiverCompany" name="receiverCompany" /></div>
            <div><label htmlFor="receiverMobile">Mobile *</label><input id="receiverMobile" name="receiverMobile" inputMode="tel" required /></div>
            <div className="sm:col-span-2"><label htmlFor="receiverAddress">Address *</label><input id="receiverAddress" name="receiverAddress" required /></div>
            <div><label htmlFor="receiverCity">City *</label><input id="receiverCity" name="receiverCity" required /></div>
            <div><label htmlFor="receiverState">State *</label><input id="receiverState" name="receiverState" required /></div>
            <div><label htmlFor="receiverPin">PIN code *</label><input id="receiverPin" name="receiverPin" inputMode="numeric" pattern="\d{6}" required /></div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold">Shipment</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="shipmentType">Shipment type *</label>
              <select id="shipmentType" name="shipmentType" value={shipmentType} onChange={(e) => setShipmentType(e.target.value)}>
                {SHIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="serviceId">Service *</label>
              <select id="serviceId" name="serviceId" required defaultValue="">
                <option value="" disabled>Select a service</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label htmlFor="weight">Weight (kg) *</label><input id="weight" name="weight" type="number" step="0.001" min="0.001" max="500" required /></div>
            <div><label htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" type="number" min="1" step="1" defaultValue={1} /></div>
            {shipmentType === "PARCEL" && (
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <div><label htmlFor="length">Length (cm)</label><input id="length" name="length" type="number" step="0.1" min="0" /></div>
                <div><label htmlFor="width">Width (cm)</label><input id="width" name="width" type="number" step="0.1" min="0" /></div>
                <div><label htmlFor="height">Height (cm)</label><input id="height" name="height" type="number" step="0.1" min="0" /></div>
              </div>
            )}
            <div><label htmlFor="bookingDate">Booking date *</label><input id="bookingDate" name="bookingDate" type="date" defaultValue={today} required /></div>
            <div className="sm:col-span-2"><label htmlFor="description">Description / contents</label><input id="description" name="description" placeholder="e.g. Legal documents, sample kit" /></div>
          </div>
        </section>

        {quoteError && <p className="field-error" role="alert">{quoteError}</p>}
        <button type="button" className="btn" onClick={reviewBooking} disabled={quoting}>
          {quoting ? "Calculating charges..." : "Review and calculate charges"}
        </button>
      </div>

      {/* ---- Step 2: confirmation summary ---- */}
      {step === "confirm" && quote && (
        <div className="max-w-lg space-y-4">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold">Shipment summary</h2>
            <dl className="text-sm">
              <Row k="Service" v={quote.serviceName} />
              <Row k="Weight" v={`${quote.weight} kg`} />
              <Row k="Base charge" v={rupee(quote.baseCharge)} />
              <Row k="Additional charge" v={rupee(quote.additionalCharge)} />
              <Row k={`GST (${quote.gstPercent}%)`} v={rupee(quote.gst)} />
              <Row k="Total amount" v={<strong>{rupee(quote.total)}</strong>} />
              <Row k="Account balance" v={rupee(liveBalance)} />
              <Row
                k="Balance after booking"
                v={
                  insufficient
                    ? <span className="font-semibold text-debit">Insufficient</span>
                    : <span className="font-semibold text-credit">{rupee(liveBalance - quote.total)}</span>
                }
              />
            </dl>
          </section>

          {insufficient && (
            <div className="field-error">
              <p className="font-semibold">Insufficient balance</p>
              <p className="mt-1">
                Required {rupee(quote.total)} &middot; Available {rupee(liveBalance)} &middot; Shortfall {rupee(quote.total - liveBalance)}
              </p>
              <Link href="/client/payments" className="btn mt-3 inline-flex">Add money</Link>
            </div>
          )}
          {state?.error && <p className="field-error" role="alert">{state.error}</p>}

          <div className="flex gap-2">
            <button type="button" className="btn-quiet" onClick={() => setStep("form")}>Back</button>
            {!insufficient && <SubmitButton pendingText="Confirming...">Confirm booking</SubmitButton>}
          </div>
        </div>
      )}
    </form>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-neutral-100 py-2 last:border-0">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="money text-right font-medium">{v}</dd>
    </div>
  );
}
