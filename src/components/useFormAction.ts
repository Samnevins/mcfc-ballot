"use client";
import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionState } from "@/components/ActionButton";

/**
 * useActionState, submitted via onSubmit instead of <form action>, so React
 * doesn't reset the form afterwards (users keep their input on validation errors).
 */
export function useFormAction(
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>,
  confirmMessage?: string,
) {
  const [state, run, pending] = useActionState(action, undefined);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => run(fd));
  };
  return { state, onSubmit, pending };
}
