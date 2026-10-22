import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server-only. Used solely to delete the signed-in user's own auth record. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
