"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Field, describedBy } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { requestPasswordReset } from "@/features/auth/actions";

interface Values {
  email: string;
}

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (v: Values) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await requestPasswordReset(v);
        if (!r) return;
        if (!r.ok && r.fieldErrors) {
          for (const [k, m] of Object.entries(r.fieldErrors)) {
            setError(k as keyof Values, { message: m });
          }
        }
        setMsg({ ok: r.ok, message: r.message });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[ForgotPasswordForm] Unexpected error:", err);
        }
        setMsg({
          ok: false,
          message: "Unable to send a reset link right now. Please check your connection and try again.",
        });
      }
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field id="email" label="Email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="input"
          aria-invalid={!!errors.email}
          aria-describedby={describedBy("email", errors.email?.message)}
          {...register("email", { required: "Enter your email address" })}
        />
      </Field>
      <FormMessage state={msg} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-muted">
        Remembered your password?{" "}
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
