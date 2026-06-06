import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { QuizRunner } from "@/app/quiz/[attemptId]/runner";
import { type Question, type QuizAttempt } from "@/lib/types";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireUser();
  const { attemptId } = await params;

  let attempt: QuizAttempt | null = null;
  let questions: Question[] = [];
  let error: string | null = null;
  try {
    // The backend has GET /quiz-attempts/{id} for full result, and
    // GET /question-sets/{id} to fetch questions. We compose them here.
    const a = await api<QuizAttempt>(`/quiz-attempts/${attemptId}`);
    attempt = a;
    const qs = await api<{ questions: Question[] }>(`/question-sets/${a.question_set_id}`);
    questions = qs.questions;
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="pt-6 text-sm">Could not load quiz: {error}</CardContent>
          </Card>
        </main>
    );
  }
  if (!attempt) notFound();
  if (attempt.status !== "in_progress") {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-3">
          <p className="text-sm text-muted-foreground">
            This attempt is already {attempt.status}.
          </p>
          <Link href={`/results/${attempt.id}`} className="text-sm underline">
            View results
          </Link>
        </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
        <QuizRunner attemptId={attempt.id} questions={questions} />
      </main>
  );
}
