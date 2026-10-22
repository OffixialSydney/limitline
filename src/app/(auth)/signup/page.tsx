import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { AuthForm } from "@/components/layout/AuthForm";

export const metadata: Metadata = { title: "Create account" };
export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Your accounts, clearly measured.">
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
