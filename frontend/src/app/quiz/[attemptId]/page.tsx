import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { QuizRunner } from "@/app/quiz/[attemptId]/runner";
import { type QuestionSetDetail } from "@/lib/types";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ setId?: string }>;
}) {
  await requireUser();
  const { attemptId } = await params;
  const { setId } = await searchParams;

  if (!setId) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-3">
          <Card>
            <CardContent className="pt-6 text-sm">
              Quiz is missing the question set reference. Please start a new quiz from the question
              set page.
            </CardContent>
          </Card>
          <Link href="/materials" className="text-sm underline">
            Back to materials
          </Link>
        </main>
    );
  }

  let qs: QuestionSetDetail | null = null;
  let error: string | null = null;
  try {
    // Backend doesn't expose GET /quiz-attempts/{id} for in-progress attempts.
    // The setId is passed via the URL; we fetch the set's questions from /question-sets/{id}.
    qs = await api<QuestionSetDetail>(`/question-sets/${setId}`);
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
  if (!qs) notFound();

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
        <QuizRunner attemptId={attemptId} questions={qs.questions} />
      </main>
  );
}
