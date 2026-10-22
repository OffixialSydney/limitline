import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { AuthForm } from "@/components/layout/AuthForm";

export const metadata: Metadata = { title: "Sign in" };
export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Know where you stand. Understand your limits.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
