"use client";
import { ErrorState } from "@/components/ui/EmptyState";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <ErrorState title="This page could not be loaded">
        Your records have not been changed. Try again, and if it keeps failing, check your connection or your Supabase project status.
      </ErrorState>
      <button type="button" onClick={reset} className="btn-secondary mt-4">Try again</button>
    </div>
  );
}
