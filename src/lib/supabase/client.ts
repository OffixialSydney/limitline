import { createBrowserClient } from "@supabase/ssr";

function normalizeSupabaseUrl(raw = ""): string {
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const dash = cleaned.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash?.[1]) return `https://${dash[1]}.supabase.co`;
  return cleaned.replace(/\/rest\/v1$/i, "");
}

export function createClient() {
  return createBrowserClient(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
  );
}
