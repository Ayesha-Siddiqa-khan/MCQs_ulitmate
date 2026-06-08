import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { QuizRunner } from "@/app/quiz/[attemptId]/runner";
import { type QuizAttemptDetail } from "@/lib/types";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireUser();
  const { attemptId } = await params;

  let attempt: QuizAttemptDetail | null = null;
  let error: string | null = null;
  try {
    attempt = await api<QuizAttemptDetail>(`/quiz-attempts/${attemptId}`);
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
  if (attempt.is_submitted) {
    return (
      <main className="container mx-auto max-w-2xl space-y-3 px-4 py-8">
        <Card>
          <CardContent className="pt-6 text-sm">
            This quiz has already been submitted.
          </CardContent>
        </Card>
        <Link href={`/results/${attemptId}`} className="text-sm underline">
          View results
        </Link>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
        <QuizRunner attemptId={attemptId} questions={attempt.questions} />
      </main>
  );
}
