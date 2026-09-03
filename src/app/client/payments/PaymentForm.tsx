"use client";

import { useRef } from "react";
import { useFormState } from "react-dom";
import { submitPayment } from "@/actions/payments";
import { SubmitButton } from "@/components/SubmitButton";

export function PaymentForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useFormState(async (prev: Awaited<ReturnType<typeof submitPayment>>, data: FormData) => {
    const result = await submitPayment(prev, data);
    if (result?.success) ref.current?.reset();
    return result;
  }, undefined);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <div>
        <label htmlFor="amount">Amount paid (&#8377;) *</label>
        <input id="amount" name="amount" type="number" step="0.01" min="1" required />
      </div>
      <div>
        <label htmlFor="paymentMethod">Payment method *</label>
        <select id="paymentMethod" name="paymentMethod" required defaultValue="UPI">
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
        </select>
      </div>
      <div>
        <label htmlFor="utrNumber">UTR / transaction number *</label>
        <input id="utrNumber" name="utrNumber" minLength={6} required />
      </div>
      <div>
        <label htmlFor="paymentDate">Payment date *</label>
        <input id="paymentDate" name="paymentDate" type="date" defaultValue={today} max={today} required />
      </div>
      <div>
        <label htmlFor="screenshot">Payment screenshot (optional)</label>
        <input id="screenshot" name="screenshot" type="file" accept="image/*" className="text-sm" />
      </div>
      {state?.error && <p className="field-error" role="alert">{state.error}</p>}
      {state?.success && <p className="field-ok" role="status">{state.success}</p>}
      <SubmitButton className="btn w-full" pendingText="Submitting...">Submit payment</SubmitButton>
    </form>
  );
}
