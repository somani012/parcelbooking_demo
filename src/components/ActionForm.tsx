"use client";

import { useRef } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "./SubmitButton";

type State = { error?: string; success?: string } | undefined;

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className = "space-y-3",
  buttonClassName = "btn",
  resetOnSuccess = false,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  resetOnSuccess?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(async (prev: State, data: FormData) => {
    const result = await action(prev, data);
    if (result?.success && resetOnSuccess) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && <p className="field-error" role="alert">{state.error}</p>}
      {state?.success && <p className="field-ok" role="status">{state.success}</p>}
      <SubmitButton className={buttonClassName} pendingText={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
