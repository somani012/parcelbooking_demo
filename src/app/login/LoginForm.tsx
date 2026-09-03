"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login } from "@/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn w-full" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState(login, undefined);
  return (
    <form action={action} className="card space-y-4 p-6">
      <div>
        <label htmlFor="identifier">Email or mobile number</label>
        <input id="identifier" name="identifier" autoComplete="username" required />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="field-error" role="alert">{state.error}</p>}
      <Submit />
    </form>
  );
}
