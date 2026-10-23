import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(nextParam: string | null, typeParam: string | null): string {
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    return nextParam;
  }
  if (typeParam === "recovery") {
    return "/reset-password";
  }
  return "/app/overview";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const errorParam = searchParams.get("error") ?? searchParams.get("error_code");
  const safeNext = getSafeNextPath(searchParams.get("next"), type);
  const isRecovery = safeNext.startsWith("/reset-password") || type === "recovery";

  if (errorParam) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth/callback] Provider returned error param:", {
        error: errorParam,
        description: searchParams.get("error_description"),
      });
    }
    return NextResponse.redirect(
      isRecovery ? `${origin}/reset-password?error=expired_or_invalid` : `${origin}/login?error=invalid_link`
    );
  }

  try {
    const supabase = await createClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("[auth/callback] exchangeCodeForSession failed:", {
          code: error.code,
          status: error.status,
          message: error.message,
        });
      }
      return NextResponse.redirect(
        isRecovery ? `${origin}/reset-password?error=expired_or_invalid` : `${origin}/login?error=invalid_link`
      );
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });
      if (!error) {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("[auth/callback] verifyOtp failed:", {
          code: error.code,
          status: error.status,
          message: error.message,
        });
      }
      return NextResponse.redirect(
        isRecovery ? `${origin}/reset-password?error=expired_or_invalid` : `${origin}/login?error=invalid_link`
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[auth/callback] Unexpected error:", err);
    }
    return NextResponse.redirect(
      isRecovery ? `${origin}/reset-password?error=expired_or_invalid` : `${origin}/login?error=invalid_link`
    );
  }

  return NextResponse.redirect(isRecovery ? `${origin}/reset-password?error=expired_or_invalid` : `${origin}/login`);
}
