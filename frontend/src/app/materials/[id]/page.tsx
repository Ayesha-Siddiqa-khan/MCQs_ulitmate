import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, FileText } from "lucide-react";

import { MaterialActions } from "@/app/materials/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type Material, type MaterialStatus, type QuestionSet } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<MaterialStatus, string> = {
  uploaded: "bg-blue-500 text-white hover:bg-blue-500/90",
  extracted: "bg-green-500 text-white hover:bg-green-500/90",
  failed: "bg-red-500 text-white hover:bg-red-500/90",
  manual: "bg-purple-500 text-white hover:bg-purple-500/90",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/materials">
            <ArrowLeft className="h-4 w-4" /> Materials
          </Link>
        </Button>
        <Card className="border-2 border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Could not load material: {error}
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!material) notFound();

  const charCount = material.extracted_text?.length ?? 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/materials">
          <ArrowLeft className="h-4 w-4" /> Materials
        </Link>
      </Button>

      <PageHeader
        title={material.title}
        description={`${material.file_type.toUpperCase()} · ${formatSize(material.size_bytes)}${material.page_count ? ` · ${material.page_count} pages` : ""}`}
        actions={
          <Badge
            className={cn(
              "border-transparent px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
              STATUS_TONE[material.status],
            )}
          >
            {material.status}
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {material.subject ? (
          <span className="rounded bg-muted px-2 py-0.5">{material.subject}</span>
        ) : null}
        {material.chapter ? (
          <span className="rounded bg-muted px-2 py-0.5">{material.chapter}</span>
        ) : null}
        {material.topic ? (
          <span className="rounded bg-muted px-2 py-0.5">{material.topic}</span>
        ) : null}
        <span>·</span>
        <span>Created {formatDate(material.created_at)}</span>
      </div>

      {material.status === "failed" ? (
        <Card className="border-2 border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            Text extraction failed for this file. Try re-uploading or use Re-extract below.
          </CardContent>
        </Card>
      ) : null}

      <MaterialActions material={material} />

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Extracted text
          </CardTitle>
          <CardDescription>
            {charCount > 0
              ? `${charCount.toLocaleString()} characters · This is what we will feed to the AI when you generate questions.`
              : "This is what we will feed to the AI when you generate questions."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {material.extracted_text ? (
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap font-mono">
              {material.extracted_text}
            </pre>
          ) : (
            <EmptyState
              icon={FileText}
              title="No text extracted yet"
              description={
                material.status === "uploaded"
                  ? "Click Extract text above to run the extractor."
                  : "The file has not been extracted. Try retrying the extraction."
              }
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Question sets from this material
          </CardTitle>
          <CardDescription>
            Practice these question sets to master the material.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No question sets yet. Generate MCQs to create your first set.
            </p>
          ) : (
            <ul className="space-y-2">
              {sets.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/quiz-sets/${s.id}`}
                    className="group flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium group-hover:text-primary transition-colors">
                        {s.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.total_questions} questions · {s.mode.replace(/_/g, " ")}
                        {s.difficulty ? ` · ${s.difficulty}` : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      Open
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
