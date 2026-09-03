"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn", pendingText }: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? pendingText ?? "Working..." : children}
    </button>
  );
}
