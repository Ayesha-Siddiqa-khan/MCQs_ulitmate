import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, FileQuestion } from "lucide-react";

import { StartAttemptButton } from "@/app/quiz-sets/[id]/start-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type QuestionSetDetail } from "@/lib/types";

export default async function QuizSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  let qs: QuestionSetDetail | null = null;
  let error: string | null = null;
  try {
    qs = await api<QuestionSetDetail>(`/question-sets/${id}`);
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
            Could not load set: {error}
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!qs) notFound();

  const previewQuestions = qs.questions.slice(0, 10);
  const hiddenPreviewCount = Math.max(0, qs.questions.length - previewQuestions.length);
  const setupQuestions = qs.questions.map((q) => ({
    id: q.id,
    chapter: q.chapter,
    topic: q.topic,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/materials">
          <ArrowLeft className="h-4 w-4" /> Materials
        </Link>
      </Button>

      <PageHeader
        title={qs.title}
        description={`${qs.total_questions} questions · ${qs.mode.replace(/_/g, " ")}${qs.difficulty ? ` · ${qs.difficulty}` : ""}`}
        icon={BookOpen}
        actions={
          qs.material_id ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/materials/${qs.material_id}`}>View material</Link>
            </Button>
          ) : null
        }
      />

      <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-background to-purple-500/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileQuestion className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>Set up your quiz</CardTitle>
              <CardDescription>
                Choose how many questions to practice. Answers are graded after submission, and
                wrong answers go to your mistake bank.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StartAttemptButton setId={qs.id} questions={setupQuestions} />
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Preview questions</CardTitle>
          <CardDescription>
            A quick look at what you&apos;ll be answering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {qs.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              This set has no questions yet.
            </p>
          ) : (
            previewQuestions.map((q, i) => (
              <div key={q.id} className="rounded-lg border-2 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {i + 1}. {q.question_text}
                  </p>
                  {q.difficulty ? (
                    <Badge variant="secondary" className="uppercase text-[10px]">
                      {q.difficulty}
                    </Badge>
                  ) : null}
                </div>
                {q.options.length > 0 ? (
                  <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc">
                    {q.options.map((o) => (
                      <li key={o.key}>
                        <span className="font-mono mr-1">{o.key}.</span> {o.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
          {hiddenPreviewCount > 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
              Showing the first {previewQuestions.length} questions. The setup panel can load any
              amount from the full {qs.questions.length} question set.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
