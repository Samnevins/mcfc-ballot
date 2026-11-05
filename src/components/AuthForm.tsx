"use client";
import Link from "next/link";
import { useFormAction } from "@/components/useFormAction";
import { loginAction, registerAction } from "@/app/actions";

function Field({ name, label, type = "text", required = true, hint, autoComplete }: {
  name: string; label: string; type?: string; required?: boolean; hint?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label} {!required && <span className="font-normal text-slate-400">(optional)</span>}
      </label>
      <input id={name} name={name} type={type} className="input" required={required} autoComplete={autoComplete} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function LoginForm() {
  const { state, onSubmit, pending } = useFormAction(loginAction);
  return (
    <div className="mx-auto mt-10 max-w-sm card">
      <h1 className="mb-4">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field name="email" label="Email" type="email" autoComplete="email" />
        <Field name="password" label="Password" type="password" autoComplete="current-password" />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>Sign in</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        New to the ballot? <Link href="/register" className="text-sky-dark underline">Register</Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const { state, onSubmit, pending } = useFormAction(registerAction);
  if (state?.ok) {
    return (
      <div className="mx-auto mt-10 max-w-md card text-center">
        <h1 className="mb-3">Registration received</h1>
        <p className="text-slate-600">{state.ok}</p>
        <Link href="/login" className="btn mt-5">Back to sign in</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-10 max-w-md card">
      <h1 className="mb-1">Register</h1>
      <p className="mb-4 text-sm text-slate-500">
        Join the MCFC London Supporters Club ticket ballot. A club admin checks each registration before you can sign in.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field name="name" label="Full name" autoComplete="name" />
        <Field name="email" label="Email" type="email" autoComplete="email" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="phone" label="Phone" type="tel" required={false} autoComplete="tel" />
          <Field name="membershipNumber" label="Membership no." required={false} hint="Helps us match your club membership." />
        </div>
        <Field name="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." />
        <Field name="confirm" label="Confirm password" type="password" autoComplete="new-password" />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Submitting…" : "Register"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered? <Link href="/login" className="text-sky-dark underline">Sign in</Link>
      </p>
    </div>
  );
}
