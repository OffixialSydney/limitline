import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLES = ["profiles", "challenges", "challenge_rules", "trades", "balance_events", "account_snapshots", "trading_days", "notifications", "audit_logs"] as const;

/** Exports only the signed-in user's rows. Row Level Security enforces this even if the code were wrong. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(from, from + 999);
      if (error) return NextResponse.json({ error: `Export failed while reading ${t}.` }, { status: 500 });
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    out[t] = rows;
  }
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), data: out }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="limitline-export.json"', "Cache-Control": "no-store" },
  });
}
