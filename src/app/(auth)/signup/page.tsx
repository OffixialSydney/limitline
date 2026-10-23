import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { AuthForm } from "@/components/layout/AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a workspace to track your prop firm evaluations and configured rules."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
