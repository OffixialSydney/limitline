import { Skeleton } from "@/components/ui/EmptyState";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-72 w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
