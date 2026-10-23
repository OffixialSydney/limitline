"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flattenZod, type ActionResult } from "@/lib/validation/common";

export type AuthActionData = { redirectTo?: string };

const emailField = z.string().trim().email("Enter a valid email address");

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password").max(72, "Use 72 characters or fewer"),
});

const signupSchema = z.object({
  email: emailField,
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use 72 characters or fewer"),
  displayName: z.string().trim().max(80).optional(),
});

const forgotPasswordSchema = z.object({
  email: emailField,
});

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(72, "Use 72 characters or fewer"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** Logs diagnostic details in development without ever logging passwords, tokens, or secrets. */
function logAuthDiagnostic(scope: string, err: unknown) {
  if (process.env.NODE_ENV === "production") return;
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; status?: unknown; name?: unknown; message?: unknown };
    console.error(`[auth:${scope}]`, {
      name: e.name,
      code: e.code,
      status: e.status,
      message: e.message,
    });
  } else {
    console.error(`[auth:${scope}]`, err);
  }
}

function isServiceOrNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("<!doctype") ||
    m.includes("unexpected token '<'") ||
    m.includes("fetch failed") ||
    m.includes("network") ||
    m.includes("failed to fetch") ||
    m.includes("enotfound") ||
    m.includes("econnrefused")
  );
}

/** Resolves the public site URL for auth callbacks on Vercel and localhost. */
async function getSiteUrl(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  try {
    const h = await headers();
    const origin = h.get("origin");
    if (origin && /^https?:\/\//i.test(origin)) {
      return origin.replace(/\/+$/, "");
    }
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  } catch {
    // Ignore header read failures outside request context
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}

function mapLoginError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (isServiceOrNetworkError(message)) {
    return "Unable to reach the authentication service. Please check your connection and try again.";
  }
  if (code === "over_request_rate_limit" || m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many sign-in attempts. Please wait a moment and try again.";
  }
  if (code === "email_not_confirmed" || m.includes("email not confirmed")) {
    return "Please confirm your email address before signing in, or request a new link.";
  }
  // Standard generic message for unregistered emails or wrong passwords so account existence is not disclosed.
  return "Invalid email or password.";
}

function mapSignupError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (isServiceOrNetworkError(message)) {
    return "Unable to reach the authentication service. Please check your connection and try again.";
  }
  if (code === "over_email_send_rate_limit" || m.includes("rate limit")) {
    return "Too many requests right now. Please wait a few minutes and try again.";
  }
  if (code === "user_already_exists" || m.includes("already registered")) {
    return "The account could not be created. If you already have an account, sign in or reset your password.";
  }
  if (m.includes("database error")) {
    return "Account setup could not be completed due to a database configuration issue.";
  }
  return "The account could not be created. Please check your details and try again.";
}

export async function login(input: { email: string; password: string }): Promise<ActionResult<AuthActionData>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      logAuthDiagnostic("login", error);
      return { ok: false, message: mapLoginError(error.message, error.code) };
    }

    if (!data?.session) {
      return { ok: false, message: "Invalid email or password." };
    }

    return { ok: true, message: "Signed in.", data: { redirectTo: "/app/overview" } };
  } catch (err) {
    logAuthDiagnostic("login:exception", err);
    return {
      ok: false,
      message: "Unable to sign in right now. Please check your connection and try again.",
    };
  }
}

export async function signup(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<ActionResult<AuthActionData>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  }

  try {
    const supabase = await createClient();
    const site = await getSiteUrl();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName ?? "" },
        emailRedirectTo: `${site}/auth/callback`,
      },
    });

    if (error) {
      logAuthDiagnostic("signup", error);
      return { ok: false, message: mapSignupError(error.message, error.code) };
    }

    if (data.session) {
      return { ok: true, message: "Account created.", data: { redirectTo: "/app/overview" } };
    }

    return { ok: true, message: "Check your email for a confirmation link, then sign in." };
  } catch (err) {
    logAuthDiagnostic("signup:exception", err);
    return {
      ok: false,
      message: "Unable to create your account right now. Please check your connection and try again.",
    };
  }
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address.", fieldErrors: flattenZod(parsed.error) };
  }

  try {
    const supabase = await createClient();
    const site = await getSiteUrl();
    const redirectTo = `${site}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo,
    });

    if (error) {
      logAuthDiagnostic("requestPasswordReset", error);
      const m = error.message.toLowerCase();
      if (isServiceOrNetworkError(error.message)) {
        return {
          ok: false,
          message: "Unable to reach the authentication service. Please check your connection and try again.",
        };
      }
      if (error.code === "over_email_send_rate_limit" || m.includes("rate limit") || m.includes("security purposes")) {
        return {
          ok: false,
          message: "Too many password reset requests. Please wait a few minutes before trying again.",
        };
      }
      // For any other error, do not disclose whether the email is registered.
    }

    return {
      ok: true,
      message:
        "If an account exists for that email address, we have sent a password reset link. Please check your inbox and spam folder.",
    };
  } catch (err) {
    logAuthDiagnostic("requestPasswordReset:exception", err);
    return {
      ok: false,
      message: "Unable to process your request right now. Please check your connection and try again.",
    };
  }
}

export async function updatePassword(input: {
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<AuthActionData>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError) logAuthDiagnostic("updatePassword:getUser", userError);
      return {
        ok: false,
        message: "Your password reset session is missing or has expired. Please request a new reset link.",
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      logAuthDiagnostic("updatePassword", error);
      const m = error.message.toLowerCase();
      if (error.code === "same_password" || m.includes("different from the old password")) {
        return {
          ok: false,
          message: "Choose a new password that is different from your current password.",
          fieldErrors: { password: "Must be different from your current password" },
        };
      }
      if (error.code === "weak_password" || m.includes("weak")) {
        return {
          ok: false,
          message: "Choose a stronger password with at least 8 characters.",
          fieldErrors: { password: "Choose a stronger password" },
        };
      }
      return {
        ok: false,
        message: "Your password could not be updated. Please request a new reset link and try again.",
      };
    }

    // Sign out the recovery session so the user signs in cleanly with their new password.
    await supabase.auth.signOut();

    return {
      ok: true,
      message: "Your password has been updated. Sign in with your new password.",
      data: { redirectTo: "/login?reset=success" },
    };
  } catch (err) {
    logAuthDiagnostic("updatePassword:exception", err);
    return {
      ok: false,
      message: "Unable to update your password right now. Please check your connection and try again.",
    };
  }
}

export async function logout(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    logAuthDiagnostic("logout", err);
  }
  redirect("/login");
}
