import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireSession } from "@/lib/server/context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user, profile } = await requireSession();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  return <AppShell unread={count ?? 0} displayName={profile.display_name ?? user.email ?? "Account"}>{children}</AppShell>;
}
