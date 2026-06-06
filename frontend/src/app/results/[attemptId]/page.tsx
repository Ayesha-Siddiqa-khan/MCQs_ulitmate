import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type QuizResult, type TopicBreakdown } from "@/lib/types";

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

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Quiz results</h1>
          <p className="text-sm text-muted-foreground">
            {r.total_questions} questions · {r.time_spent_seconds}s
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Score</CardTitle>
            <CardDescription>
              {r.correct} correct · {r.incorrect} wrong · {r.unanswered} unanswered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={r.percentage} />
            <p className="text-2xl font-semibold">{Math.round(r.percentage)}%</p>
            {r.incorrect > 0 ? (
              <Button asChild className="mt-2">
                <Link href="/practice">Practice my mistakes</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {r.topic_breakdown.length > 0 || r.difficulty_breakdown.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              {r.topic_breakdown.length > 0 ? (
                <BreakdownSection title="By topic" items={r.topic_breakdown} />
              ) : null}
              {r.difficulty_breakdown.length > 0 ? (
                <BreakdownSection title="By difficulty" items={r.difficulty_breakdown} />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Question-by-question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.questions.map((qr, i) => {
              const isRight = qr.is_correct === true;
              const q = qr.question;
              return (
                <div key={q?.id ?? i} className="rounded border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      {i + 1}. {q?.question_text ?? "(question unavailable)"}
                    </p>
                    {qr.is_correct === null ? (
                      <Badge variant="outline">unanswered</Badge>
                    ) : isRight ? (
                      <Badge>correct</Badge>
                    ) : (
                      <Badge variant="destructive">wrong</Badge>
                    )}
                  </div>
                  {q && q.options.length > 0 ? (
                    <ul className="text-sm space-y-1 pl-4 list-disc">
                      {q.options.map((o) => {
                        const isUser = qr.selected_answer === o.key;
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
                  ) : qr.selected_answer ? (
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Your answer: </span>
                        {qr.selected_answer}
                      </p>
                      {q?.explanation ? (
                        <p>
                          <span className="text-muted-foreground">Explanation: </span>
                          {q.explanation}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
  );
}

function BreakdownSection({
  title,
  items,
}: {
  title: string;
  items: TopicBreakdown[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((b) => {
          const pct = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0;
          return (
            <li key={b.label} className="space-y-0.5">
              <div className="flex items-center justify-between text-sm">
                <span>{b.label}</span>
                <span className="text-muted-foreground">
                  {b.correct}/{b.total} · {pct}%
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
