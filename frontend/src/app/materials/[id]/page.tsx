import Link from "next/link";
import { notFound } from "next/navigation";

import { MaterialActions } from "@/app/materials/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type Material, type QuestionSet } from "@/lib/types";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  let material: Material | null = null;
  let sets: QuestionSet[] = [];
  let error: string | null = null;
  try {
    material = await api<Material>(`/materials/${id}`);
    // Backend's GET /question-sets returns all of the user's sets; filter locally.
    try {
      const all = await api<QuestionSet[]>("/question-sets");
      sets = (all ?? []).filter((s) => s.material_id === id);
    } catch {
      sets = [];
    }
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
          <Link href="/materials" className="text-sm text-muted-foreground hover:underline">
            ← Materials
          </Link>
          <Card>
            <CardContent className="pt-6 text-sm">Could not load material: {error}</CardContent>
          </Card>
        </main>
    );
  }
  if (!material) notFound();

  const charCount = material.extracted_text?.length ?? 0;

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href="/materials" className="text-sm text-muted-foreground hover:underline">
            ← Materials
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{material.title}</h1>
              <p className="text-sm text-muted-foreground">
                {material.file_type.toUpperCase()} · {charCount.toLocaleString()} chars
                {material.page_count ? ` · ${material.page_count} pages` : ""}
              </p>
            </div>
            <Badge>{material.status}</Badge>
          </div>
        </div>

        {material.status === "failed" ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              Text extraction failed for this file. Try re-uploading or use Re-extract below.
            </CardContent>
          </Card>
        ) : null}

        <MaterialActions material={material} />

        <Card>
          <CardHeader>
            <CardTitle>Extracted text</CardTitle>
            <CardDescription>
              This is what we will feed to the AI when you generate questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {material.extracted_text ? (
              <pre className="max-h-96 overflow-auto rounded bg-muted p-4 text-xs whitespace-pre-wrap">
                {material.extracted_text}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                No text extracted yet.
                {material.status === "uploaded" ? " Click Re-extract above." : ""}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Question sets from this material</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No question sets yet.</p>
            ) : (
              sets.map((s) => (
                <Link
                  key={s.id}
                  href={`/quiz-sets/${s.id}`}
                  className="flex items-center justify-between rounded border p-3 hover:border-foreground/30"
                >
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.total_questions} questions · {s.mode.replace(/_/g, " ")}
                      {s.difficulty ? ` · ${s.difficulty}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Open
                  </Button>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </main>
  );
}
