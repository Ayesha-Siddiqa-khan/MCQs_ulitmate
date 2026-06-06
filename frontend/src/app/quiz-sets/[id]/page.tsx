import Link from "next/link";
import { notFound } from "next/navigation";

import { StartAttemptButton } from "@/app/quiz-sets/[id]/start-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
          <Link href="/materials" className="text-sm text-muted-foreground hover:underline">
            ← Materials
          </Link>
          <Card>
            <CardContent className="pt-6 text-sm">Could not load set: {error}</CardContent>
          </Card>
        </main>
    );
  }
  if (!qs) notFound();

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <Link href="/materials" className="text-sm text-muted-foreground hover:underline">
            ← Materials
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">{qs.title}</h1>
          <p className="text-sm text-muted-foreground">
            {qs.total_questions} questions · {qs.mode.replace(/_/g, " ")}
            {qs.difficulty ? ` · ${qs.difficulty}` : ""}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ready to start?</CardTitle>
            <CardDescription>
              Your answers are graded when you submit. Wrong answers go to your mistake bank.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StartAttemptButton setId={qs.id} />
            <Button asChild variant="outline">
              <Link href="/materials">Back</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qs.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">This set has no questions yet.</p>
            ) : (
              qs.questions.map((q, i) => (
                <div key={q.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {i + 1}. {q.question_text}
                    </p>
                    {q.difficulty ? (
                      <Badge variant="secondary">{q.difficulty}</Badge>
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
          </CardContent>
        </Card>
      </main>
  );
}
