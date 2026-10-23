import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { AuthForm } from "@/components/layout/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const params = await searchParams;
  const initialMessage =
    params.reset === "success"
      ? { ok: true, message: "Your password has been updated. Sign in with your new password." }
      : params.error === "invalid_link"
        ? { ok: false, message: "That authentication link is invalid or has expired. Please try again." }
        : null;

  return (
    <AuthShell title="Sign in" subtitle="Access your challenge ledger and recorded observations.">
      <AuthForm mode="login" initialMessage={initialMessage} />
    </AuthShell>
  );
}
