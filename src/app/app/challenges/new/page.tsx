import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChallengeForm, EMPTY_CHALLENGE } from "@/components/challenges/ChallengeForm";
import { requireSession } from "@/lib/server/context";
import { localDate } from "@/lib/calculations/time";

export const metadata: Metadata = { title: "New challenge" };

export default async function NewChallengePage() {
  const { profile } = await requireSession();
  return (
    <>
      <PageHeader title="New challenge" description="Enter your account and the rules your firm sets. Everything Limitline shows is calculated from these rules and the values you record."
        back={<Link href="/app/challenges" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={14} aria-hidden="true" />Challenges</Link>} />
      <div className="max-w-3xl">
        <ChallengeForm mode="create" defaults={{ ...EMPTY_CHALLENGE, accountCurrency: profile.preferred_currency }} today={localDate(new Date(), profile.timezone)} />
      </div>
    </>
  );
}
