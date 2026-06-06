import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type QuizResult } from "@/lib/types";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireUser();
  const { attemptId } = await params;

  let result: QuizResult | null = null;
  let error: string | null = null;
  try {
    result = await api<QuizResult>(`/quiz-attempts/${attemptId}/result`);
  } catch (e) {
    error = (e as Error).message;
  }
  if (error) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
          <Card>
            <CardContent className="pt-6 text-sm">Could not load results: {error}</CardContent>
          </Card>
        </main>
    );
  }
  if (!result) notFound();

  const r = result;
  const wrong = r.breakdown.filter((q) => q.answered && !q.is_correct).length;
  const correct = r.breakdown.filter((q) => q.is_correct === true).length;
  const unanswered = r.breakdown.filter((q) => !q.answered).length;

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">
            {r.question_set_title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {r.attempt.total_questions} questions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Score</CardTitle>
            <CardDescription>
              {correct} correct · {wrong} wrong · {unanswered} unanswered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={r.attempt.score_percent} />
            <p className="text-2xl font-semibold">{r.attempt.score_percent.toFixed(0)}%</p>
            {wrong > 0 ? (
              <Button asChild className="mt-2">
                <Link href="/practice">Practice my mistakes</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.breakdown.map((q, i) => {
              const isRight = q.is_correct === true;
              return (
                <div
                  key={q.question_id}
                  className="rounded border p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      {i + 1}. {q.prompt}
                    </p>
                    {!q.answered ? (
                      <Badge variant="outline">unanswered</Badge>
                    ) : isRight ? (
                      <Badge>correct</Badge>
                    ) : (
                      <Badge variant="destructive">wrong</Badge>
                    )}
                  </div>
                  {q.options_json ? (
                    <ul className="text-sm space-y-1 pl-4 list-disc">
                      {q.options_json.map((o) => {
                        const isUser = q.user_answer === o.key;
                        const isCorrect = q.correct_answer === o.key;
                        return (
                          <li
                            key={o.key}
                            className={
                              isCorrect
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isUser
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            <span className="font-mono mr-1">{o.key}.</span> {o.text}
                            {isUser ? " (your answer)" : ""}
                            {isCorrect ? " (correct)" : ""}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Your answer: </span>
                        {q.user_answer || <em>unanswered</em>}
                      </p>
                      {q.model_answer ? (
                        <p>
                          <span className="text-muted-foreground">Model answer: </span>
                          {q.model_answer}
                        </p>
                      ) : null}
                    </div>
                  )}
                  {q.explanation ? (
                    <p className="text-sm text-muted-foreground">{q.explanation}</p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
  );
}
