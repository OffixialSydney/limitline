import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChallengeForm } from "@/components/challenges/ChallengeForm";
import { requireSession } from "@/lib/server/context";
import { formDefaultsFromRows } from "@/lib/server/challenge-defaults";
import { localDate } from "@/lib/calculations/time";
import { uuid } from "@/lib/validation/common";
import type { ChallengeRow, RuleRow } from "@/types/db";

export const metadata: Metadata = { title: "Edit challenge" };

export default async function EditChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { supabase, user, profile } = await requireSession();
  const { data: c } = await supabase.from("challenges").select("*").eq("id", id).eq("user_id", user.id).maybeSingle<ChallengeRow>();
  if (!c) notFound(); // other users' ids look identical to missing ones
  const { data: rules } = await supabase.from("challenge_rules").select("id, challenge_id, rule_type, configuration, source_reference, version, verified_at, updated_at").eq("challenge_id", id);
  return (
    <>
      <PageHeader title={`Edit ${c.name}`} description="Changing a rule changes how status is calculated from your recorded values. Rule changes are logged in the account history."
        back={<Link href={`/app/challenges/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={14} aria-hidden="true" />{c.name}</Link>} />
      <div className="max-w-3xl"><ChallengeForm mode="edit" challengeId={id} defaults={formDefaultsFromRows(c, (rules ?? []) as RuleRow[])} today={localDate(new Date(), profile.timezone)} /></div>
    </>
  );
}
