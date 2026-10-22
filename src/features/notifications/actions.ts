"use server";
import { revalidatePath } from "next/cache";
import { getActionSession } from "@/lib/server/context";
import { syncAlerts } from "@/lib/server/alerts";
import { uuid, type ActionResult } from "@/lib/validation/common";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: "Your session has expired. Sign in again to continue." };
  if (!uuid.safeParse(id).success) return { ok: false, message: "That alert could not be found." };
  const { error } = await s.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", s.user.id).is("read_at", null);
  if (error) return { ok: false, message: "The alert could not be updated." };
  revalidatePath("/app", "layout");
  return { ok: true, message: "Marked as read." };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: "Your session has expired. Sign in again to continue." };
  const { error } = await s.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", s.user.id).is("read_at", null);
  if (error) return { ok: false, message: "Alerts could not be updated." };
  revalidatePath("/app", "layout");
  return { ok: true, message: "All alerts marked as read." };
}

/** Re-evaluates every active challenge from stored records. Does not fetch anything from a broker. */
export async function refreshAlerts(): Promise<ActionResult> {
  const s = await getActionSession();
  if (!s) return { ok: false, message: "Your session has expired. Sign in again to continue." };
  const { data, error } = await s.supabase.from("challenges").select("id").eq("user_id", s.user.id).eq("status", "active").limit(200);
  if (error) return { ok: false, message: "Challenges could not be loaded." };
  let created = 0;
  for (const c of data ?? []) created += await syncAlerts(s.supabase, s.user.id, (c as { id: string }).id, s.profile);
  revalidatePath("/app", "layout");
  return { ok: true, message: created ? `${created} new alert${created === 1 ? "" : "s"} from your recorded data.` : "No new alerts. Nothing has changed in your recorded data." };
}
