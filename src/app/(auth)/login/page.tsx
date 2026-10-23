import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { AuthForm } from "@/components/layout/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Access your challenge ledger and recorded observations.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
