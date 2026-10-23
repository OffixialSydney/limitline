import type { Metadata } from "next";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AuthShell } from "@/components/layout/AuthShell";
import { ResetPasswordForm } from "@/components/layout/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; error?: string }>;
}) {
  const params = await searchParams;
  let initialError: string | null = params.error ?? null;
  let hasServerSession = false;

  if (!initialError) {
    try {
      const supabase = await createClient();

      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) {
          initialError = "expired_or_invalid";
        }
      } else if (params.token_hash && params.type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: params.token_hash,
          type: params.type as EmailOtpType,
        });
        if (error) {
          initialError = "expired_or_invalid";
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      hasServerSession = !!user;
    } catch {
      hasServerSession = false;
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password of at least 8 characters for your Limitline account."
    >
      <ResetPasswordForm hasServerSession={hasServerSession} initialError={initialError} />
    </AuthShell>
  );
}
