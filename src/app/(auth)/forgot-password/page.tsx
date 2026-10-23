import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/AuthShell";
import { ForgotPasswordForm } from "@/components/layout/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address for your account and we will send you a link to set a new password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
