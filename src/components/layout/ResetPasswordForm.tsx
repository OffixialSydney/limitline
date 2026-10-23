"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Field, describedBy } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { updatePassword } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/client";

interface Values {
  password: string;
  confirmPassword: string;
}

export function ResetPasswordForm({
  hasServerSession,
  initialError,
}: {
  hasServerSession: boolean;
  initialError?: string | null;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<Values>();
  const [sessionReady, setSessionReady] = useState<boolean>(hasServerSession && !initialError);
  const [verifying, setVerifying] = useState<boolean>(!hasServerSession && !initialError);
  const [linkError, setLinkError] = useState<string | null>(
    initialError
      ? "This password reset link is invalid or has expired. Reset links can only be used once."
      : null
  );
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (initialError) {
      setVerifying(false);
      setSessionReady(false);
      return;
    }

    let cancelled = false;
    async function verifyClientRecoverySession() {
      try {
        const supabase = createClient();
        const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
        const hashParams = new URLSearchParams(hash);
        const searchParams =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();

        if (hashParams.get("error") || searchParams.get("error")) {
          if (!cancelled) {
            setLinkError("This password reset link is invalid or has expired. Reset links can only be used once.");
            setSessionReady(false);
            setVerifying(false);
          }
          return;
        }

        const code = searchParams.get("code");
        if (code && !hasServerSession) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[ResetPasswordForm] exchangeCodeForSession error:", error.message);
            }
            if (!cancelled) {
              setLinkError("This password reset link is invalid or has expired. Please request a new reset link.");
              setSessionReady(false);
              setVerifying(false);
            }
            return;
          }
        }

        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        if (tokenHash && type && !hasServerSession) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          });
          if (error) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[ResetPasswordForm] verifyOtp error:", error.message);
            }
            if (!cancelled) {
              setLinkError("This password reset link is invalid or has expired. Please request a new reset link.");
              setSessionReady(false);
              setVerifying(false);
            }
            return;
          }
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[ResetPasswordForm] setSession error:", error.message);
            }
            if (!cancelled) {
              setLinkError("This password reset link is invalid or has expired. Please request a new reset link.");
              setSessionReady(false);
              setVerifying(false);
            }
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!cancelled) {
          if (session || hasServerSession) {
            setSessionReady(true);
            setLinkError(null);
          } else {
            setSessionReady(false);
            setLinkError("This password reset link is invalid or has expired. Please request a new reset link.");
          }
          setVerifying(false);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[ResetPasswordForm] Unexpected error verifying recovery link:", err);
        }
        if (!cancelled) {
          setSessionReady(hasServerSession);
          if (!hasServerSession) {
            setLinkError("Unable to verify your reset link. Please request a new password reset email.");
          }
          setVerifying(false);
        }
      }
    }

    verifyClientRecoverySession();
    return () => {
      cancelled = true;
    };
  }, [hasServerSession, initialError]);

  if (verifying) {
    return (
      <div className="space-y-3 py-2 text-sm text-muted" role="status">
        <p>Verifying your password reset link…</p>
      </div>
    );
  }

  if (!sessionReady || linkError) {
    return (
      <div className="space-y-4">
        <FormMessage
          state={{
            ok: false,
            message:
              linkError ?? "This password reset link is invalid or has expired. Please request a new reset link.",
          }}
        />
        <Link href="/forgot-password" className="btn-primary w-full">
          Request a new reset link
        </Link>
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="link">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  const currentPassword = watch("password");

  const onSubmit = (v: Values) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await updatePassword(v);
        if (!r) return;

        if (!r.ok) {
          if (r.fieldErrors) {
            for (const [k, m] of Object.entries(r.fieldErrors)) {
              setError(k as keyof Values, { message: m });
            }
          }
          setMsg({ ok: false, message: r.message });
          return;
        }

        if (r.data?.redirectTo) {
          router.replace(r.data.redirectTo);
          router.refresh();
          return;
        }

        setMsg({ ok: true, message: r.message });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[ResetPasswordForm] Unexpected error updating password:", err);
        }
        setMsg({
          ok: false,
          message: "Unable to update your password right now. Please check your connection and try again.",
        });
      }
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field
        id="password"
        label="New password"
        error={errors.password?.message}
        hint="At least 8 characters."
      >
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="input"
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("password", errors.password?.message, "At least 8 characters.")}
          {...register("password", {
            required: "Enter a new password",
            minLength: { value: 8, message: "Use at least 8 characters" },
            maxLength: { value: 72, message: "Use 72 characters or fewer" },
          })}
        />
      </Field>
      <Field
        id="confirmPassword"
        label="Confirm new password"
        error={errors.confirmPassword?.message}
      >
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="input"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={describedBy("confirmPassword", errors.confirmPassword?.message)}
          {...register("confirmPassword", {
            required: "Confirm your new password",
            validate: (val) => val === currentPassword || "Passwords do not match",
          })}
        />
      </Field>
      <FormMessage state={msg} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
