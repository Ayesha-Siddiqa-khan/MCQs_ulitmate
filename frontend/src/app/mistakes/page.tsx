import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  MistakesBrowser,
  MistakesEmpty,
  MistakesPracticeCTA,
} from "@/app/mistakes/mistakes-browser";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type PaginatedMistakes } from "@/lib/types";

export default async function MistakesPage() {
  await requireUser();
  let mistakes: PaginatedMistakes = {
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
    counts: { new_mistake: 0, needs_practice: 0, improving: 0, mastered: 0, total: 0 },
  };
  let error: string | null = null;
  try {
    mistakes = await api<PaginatedMistakes>("/mistakes");
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Mistakes"
        description="Wrong answers land here. Mastery updates as you get them right."
        icon={AlertTriangle}
      />

      {error ? (
        <Card className="border-2 border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Could not reach the API: {error}
          </CardContent>
        </Card>
      ) : null}

      {mistakes.total > 0 ? <MistakesPracticeCTA /> : null}

      {mistakes.total === 0 && !error ? (
        <MistakesEmpty />
      ) : (
        <MistakesBrowser mistakes={mistakes} />
      )}
    </main>
  );
}
