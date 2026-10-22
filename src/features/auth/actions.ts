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

export async function login(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = credentials.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: "The email or password is incorrect, or the email has not been confirmed yet." };
  redirect("/app/overview");
}

export async function signup(input: { email: string; password: string; displayName?: string }): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: flattenZod(parsed.error) };
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName ?? "" }, emailRedirectTo: `${site}/auth/callback` },
  });
  if (error) return { ok: false, message: "The account could not be created. If you already have one, sign in instead." };
  if (data.session) redirect("/app/overview");
  return { ok: true, message: "Check your email for a confirmation link, then sign in." };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
