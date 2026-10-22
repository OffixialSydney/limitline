"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Field, describedBy } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { login, signup } from "@/features/auth/actions";

interface Values { email: string; password: string; displayName?: string }

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (v: Values) => start(async () => {
    setMsg(null);
    const r = mode === "login" ? await login(v) : await signup(v);
    // On success the action redirects; a returned value means a message to show.
    if (!r) return;
    if (!r.ok && r.fieldErrors) for (const [k, m] of Object.entries(r.fieldErrors)) setError(k as keyof Values, { message: m });
    setMsg({ ok: r.ok, message: r.message });
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {mode === "signup" && (
        <Field id="displayName" label="Name (optional)" error={errors.displayName?.message}>
          <input id="displayName" className="input" autoComplete="name" {...register("displayName")} />
        </Field>
      )}
      <Field id="email" label="Email" error={errors.email?.message}>
        <input id="email" type="email" inputMode="email" autoComplete="email" className="input" aria-invalid={!!errors.email} aria-describedby={describedBy("email", errors.email?.message)} {...register("email", { required: "Enter your email" })} />
      </Field>
      <Field id="password" label="Password" error={errors.password?.message} hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="input" aria-invalid={!!errors.password} aria-describedby={describedBy("password", errors.password?.message)} {...register("password", { required: "Enter your password" })} />
      </Field>
      <FormMessage state={msg} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? <>New to Limitline? <Link href="/signup" className="link">Create an account</Link></> : <>Already have an account? <Link href="/login" className="link">Sign in</Link></>}
      </p>
    </form>
  );
}
