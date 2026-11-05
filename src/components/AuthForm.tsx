"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, run, pending] = useActionState(mode === "login" ? loginAction : registerAction, undefined);
  return (
    <div className="mx-auto mt-10 max-w-sm card">
      <h1 className="mb-4">{mode === "login" ? "Sign in" : "Create account"}</h1>
      <form action={run} className="space-y-3">
        {mode === "register" && (
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required /></div>
        )}
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" required /></div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{mode === "login" ? "Sign in" : "Register"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        {mode === "login"
          ? <>No account? <Link href="/register" className="text-sky-dark underline">Register</Link></>
          : <>Have an account? <Link href="/login" className="text-sky-dark underline">Sign in</Link></>}
      </p>
    </div>
  );
}
