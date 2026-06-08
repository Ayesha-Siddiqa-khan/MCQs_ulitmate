import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Target,
  XCircle,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { TemporarySessionActions } from "@/app/results/[attemptId]/temporary-actions";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type QuizResult, type TopicBreakdown, type QuestionSet, type Material } from "@/lib/types";
import { cn } from "@/lib/utils";

function scoreTone(percentage: number): string {
  if (percentage >= 70) return "text-green-500";
  if (percentage >= 40) return "text-yellow-500";
  return "text-red-500";
}

function scoreBg(percentage: number): string {
  if (percentage >= 70) return "from-green-500/20 to-green-500/5 border-green-500/30";
  if (percentage >= 40) return "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30";
  return "from-red-500/20 to-red-500/5 border-red-500/30";
}

function formatTime(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireUser();
  const { attemptId } = await params;

  let result: QuizResult | null = null;
  let isTemporary = false;
  let materialId: string | null = null;
  let error: string | null = null;

  try {
    result = await api<QuizResult>(`/quiz-attempts/${attemptId}/result`);

    if (result?.question_set_id) {
      try {
        const qset = await api<QuestionSet>(`/question-sets/${result.question_set_id}`);
        if (qset?.material_id) {
          materialId = qset.material_id;
          const material = await api<Material>(`/materials/${materialId}`);
          isTemporary = material.storage_mode === "temporary";
        }
      } catch {
        // Non-critical: just don't show temporary actions
      }
    }
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </Button>
        <Card className="border-2 border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Could not load results: {error}
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!result) notFound();

  const r = result;
  const pct = Math.round(r.percentage);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
      </Button>

      <PageHeader
        title="Quiz results"
        description={`${r.total_questions} questions · ${formatTime(r.time_spent_seconds)}`}
        icon={BarChart3}
      />

      {isTemporary && materialId ? (
        <TemporarySessionActions materialId={materialId} attemptId={attemptId} />
      ) : null}

      <Card className={cn("border-2 bg-gradient-to-br", scoreBg(r.percentage))}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardDescription>Overall score</CardDescription>
              <p className={cn("text-5xl font-bold tracking-tight", scoreTone(r.percentage))}>
                {pct}%
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {r.score}/{r.total_questions} points
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-background/60">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> {r.correct} correct
              </Badge>
              <Badge variant="outline" className="bg-background/60">
                <XCircle className="h-3.5 w-3.5 text-red-500" /> {r.incorrect} wrong
              </Badge>
              {r.unanswered > 0 ? (
                <Badge variant="outline" className="bg-background/60">
                  <Clock className="h-3.5 w-3.5" /> {r.unanswered} skipped
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={pct} className="h-3" />
          {r.incorrect > 0 && !isTemporary ? (
            <Button asChild className="mt-4">
              <Link href="/practice">
                <Sparkles className="mr-2 h-4 w-4" /> Practice wrong questions again
              </Link>
            </Button>
          ) : !isTemporary ? (
            <Button asChild variant="outline" className="mt-4">
              <Link href="/materials">Back to materials</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {r.topic_breakdown.length > 0 || r.difficulty_breakdown.length > 0 ? (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
            <CardDescription>How you did by topic and difficulty.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {r.topic_breakdown.length > 0 ? (
              <BreakdownSection
                title="By topic"
                icon={Target}
                items={r.topic_breakdown}
              />
            ) : null}
            {r.difficulty_breakdown.length > 0 ? (
              <BreakdownSection
                title="By difficulty"
                icon={Award}
                items={r.difficulty_breakdown}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Question-by-question</CardTitle>
          <CardDescription>
            Your answer and the correct one for each question.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {r.questions.map((qr, i) => {
            const isRight = qr.is_correct === true;
            const q = qr.question;
            return (
              <div
                key={q?.id ?? i}
                className={cn(
                  "rounded-lg border-2 p-4 space-y-2",
                  isRight
                    ? "border-green-500/40 bg-green-500/5"
                    : "border-red-500/30 bg-red-500/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {i + 1}. {q?.question_text ?? "(question unavailable)"}
                  </p>
                  {qr.is_correct === null ? (
                    <Badge variant="outline">unanswered</Badge>
                  ) : isRight ? (
                    <Badge className="bg-green-500 text-white hover:bg-green-500/90">
                      correct
                    </Badge>
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
                          className={cn(
                            isCorrect
                              ? "text-emerald-600 dark:text-emerald-400 font-medium"
                              : isUser
                                ? "text-destructive"
                                : "text-muted-foreground",
                          )}
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
                  </div>
                ) : null}
                {q?.explanation ? (
                  <p className="rounded-md bg-background/70 p-3 text-sm">
                    <span className="font-medium">Explanation: </span>
                    <span className="text-muted-foreground">{q.explanation}</span>
                  </p>
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
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: TopicBreakdown[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((b) => {
          const pct = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0;
          return (
            <li key={b.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.label}</span>
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
