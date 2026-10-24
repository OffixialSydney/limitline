import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChallengeTable } from "@/components/dashboard/ChallengeTable";
import { requireSession } from "@/lib/server/context";
import { loadChallengeViews } from "@/lib/server/evaluate";

export const metadata: Metadata = { title: "Challenges" };
export const dynamic = "force-dynamic";

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile, prefs } = await requireSession();
  const { views } = await loadChallengeViews(supabase, profile, { includeArchived: true });
  const initialNotice = sp.deleted === "1" ? "Challenge permanently deleted along with all of its associated records." : null;
  return (
    <>
      <PageHeader title="Challenges" description="Create, edit, archive and permanently delete your evaluation accounts. Archiving keeps all trades and history."
        actions={<Link href="/app/challenges/new" className="btn-primary"><Plus size={16} aria-hidden="true" />New challenge</Link>} />
      <ChallengeTable rows={views} prefs={prefs} variant="manage" initialNotice={initialNotice} />
    </>
  );
}
