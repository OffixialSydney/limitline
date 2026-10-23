"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { FormMessage } from "@/components/ui/FormMessage";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[AuthError boundary]", error);
    }
  }, [error]);

  return (
    <AuthShell
      title="Authentication unavailable"
      subtitle="The request could not be completed."
    >
      <div className="space-y-4">
        <FormMessage
          state={{
            ok: false,
            message: "Something went wrong while communicating with the server. Please try again.",
          }}
        />
        <button type="button" onClick={reset} className="btn-primary w-full">
          Try again
        </button>
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="link">
            Return to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
