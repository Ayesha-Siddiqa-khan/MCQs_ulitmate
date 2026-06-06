import { PracticeStartForm } from "@/app/practice/start-form";
import { requireUser } from "@/lib/auth";

export default async function PracticePage() {
  await requireUser();
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Practice</h1>
          <p className="text-sm text-muted-foreground">
            Build a new quiz from your open mistakes, then take it like any other quiz.
          </p>
        </div>
        <PracticeStartForm />
      </main>
  );
}
