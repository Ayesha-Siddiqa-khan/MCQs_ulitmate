import { Skeleton } from "@/components/ui/skeleton";

export default function QuizSetsLoading() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </main>
  );
}
