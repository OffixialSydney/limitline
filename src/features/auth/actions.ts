"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flattenZod, type ActionResult } from "@/lib/validation/common";

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use 72 characters or fewer"),
});
const signupSchema = credentials.extend({ displayName: z.string().trim().max(80).optional() });

function mapSignupError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (code === "over_email_send_rate_limit" || m.includes("rate limit")) {
    return "Confirmation email rate limit reached. Turn off 'Confirm email' in Supabase (Authentication → Providers → Email) while testing, or wait and try again.";
  }
  if (code === "user_already_exists" || m.includes("already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (m.includes("database error")) {
    return "Database setup is incomplete. Run the reset SQL script in the Supabase SQL Editor.";
  }
  return `The account could not be created: ${message}`;
}

export async function login(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, message: `Sign in failed: ${error.message}` };
  }
  redirect("/app/overview");
}

export async function signup(input: { email: string; password: string; displayName?: string }): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  }
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName ?? "" },
      emailRedirectTo: `${site}/auth/callback`,
    },
  });
  if (error) {
    return { ok: false, message: mapSignupError(error.message, error.code) };
  }
  if (data.session) redirect("/app/overview");
  return { ok: true, message: "Check your email for a confirmation link, then sign in." };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
