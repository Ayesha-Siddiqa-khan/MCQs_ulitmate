"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react";

import { api } from "@/lib/api-client";
import { ApiCallError } from "@/lib/api-shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type QuestionPublic, type QuizResult } from "@/lib/types";

function describeSubmitError(error: unknown): string {
  if (error instanceof ApiCallError) {
    const detail = error.detail || "";
    const lower = detail.toLowerCase();

    if (error.status === 400 && lower.includes("answer all questions")) {
      return "Some answers could not be saved. Please try submitting again.";
    }
    if (error.status === 401) {
      return "Please sign in again before submitting your quiz.";
    }
    if (error.status === 403 || lower.includes("row-level security") || lower.includes("permission")) {
      return "Your result could not be saved because database permissions rejected the request.";
    }
    if (error.status >= 500) {
      return "Quiz submit service hit a server error while saving your result. Please try again.";
    }

    return detail || `Quiz submit failed with status ${error.status}.`;
  }

  if (error instanceof TypeError && /fetch|network|load/i.test(error.message)) {
    return "Quiz submit service is not reachable. Please make sure the backend is running.";
  }

  return "Quiz could not be submitted. Please try again.";
}

function logSubmitFailure(
  error: unknown,
  payloadShape: { attemptId: string; totalQuestions: number; answeredCount: number },
) {
  if (process.env.NODE_ENV === "production") return;
  const details =
    error instanceof ApiCallError
      ? { status: error.status, detail: error.detail }
      : { message: error instanceof Error ? error.message : String(error) };
  console.error("[quiz-submit]", { ...payloadShape, ...details });
}

export function QuizRunner({
  attemptId,
  questions,
}: {
  attemptId: string;
  questions: QuestionPublic[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = questions[index];
  const total = questions.length;
  const progress = useMemo(
    () => (total > 0 ? Math.round(((index + 1) / total) * 100) : 0),
    [index, total],
  );
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [questions, answers],
  );
  const navItems = useMemo(() => {
    if (total <= 60) {
      return Array.from({ length: total }, (_, i) => ({ type: "button" as const, index: i }));
    }

    const visible = new Set<number>([0, total - 1, index]);
    for (let i = Math.max(0, index - 2); i <= Math.min(total - 1, index + 2); i += 1) {
      visible.add(i);
    }

    const sorted = Array.from(visible).sort((a, b) => a - b);
    const items: Array<{ type: "button"; index: number } | { type: "ellipsis"; key: string }> =
      [];
    let previous = -1;
    for (const currentIndex of sorted) {
      if (previous >= 0 && currentIndex - previous > 1) {
        items.push({ type: "ellipsis", key: `${previous}-${currentIndex}` });
      }
      items.push({ type: "button", index: currentIndex });
      previous = currentIndex;
    }
    return items;
  }, [index, total]);

  function setAnswer(qid: string, val: string) {
    setAnswers((prev) => ({ ...prev, [qid]: val }));
  }

  function next() {
    if (index + 1 < total) setIndex(index + 1);
  }
  function prev() {
    if (index > 0) setIndex(index - 1);
  }

  function submit() {
    setError(null);
    const payload = {
      answers: questions.map((q) => ({
        question_id: q.id,
        selected_answer: (answers[q.id] ?? "").trim() || null,
      })),
    };

    startTransition(async () => {
      try {
        const r = await api<QuizResult>(`/quiz-attempts/${attemptId}/submit`, {
          method: "POST",
          json: payload,
        });
        router.replace(`/results/${r.attempt_id}`);
      } catch (e) {
        if (e instanceof ApiCallError && e.status === 409) {
          router.replace(`/results/${attemptId}`);
          return;
        }
        logSubmitFailure(e, {
          attemptId,
          totalQuestions: total,
          answeredCount,
        });
        setError(describeSubmitError(e));
      }
    });
  }

  if (!current) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          This quiz has no questions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Question {index + 1} <span className="text-muted-foreground">of {total}</span>
          </span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> {answeredCount} answered
            </span>
            {answeredCount < total ? <span>{total - answeredCount} skipped</span> : null}
            <span>{progress}%</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="border-2">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {current.subject ? (
              <span className="rounded bg-muted px-2 py-0.5">{current.subject}</span>
            ) : null}
            {current.chapter ? (
              <span className="rounded bg-muted px-2 py-0.5">{current.chapter}</span>
            ) : null}
            {current.topic ? (
              <span className="rounded bg-muted px-2 py-0.5">{current.topic}</span>
            ) : null}
            {current.difficulty ? (
              <span className="rounded bg-muted px-2 py-0.5 uppercase">{current.difficulty}</span>
            ) : null}
          </div>
          <p className="text-lg font-medium leading-relaxed md:text-xl">
            {current.question_text}
          </p>
          {current.options.length > 0 ? (
            <RadioGroup
              value={answers[current.id] ?? ""}
              onValueChange={(v) => setAnswer(current.id, v)}
              className="space-y-2"
            >
              {current.options.map((o) => {
                const selected = answers[current.id] === o.key;
                return (
                  <Label
                    key={o.key}
                    htmlFor={`${current.id}-${o.key}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors hover:bg-accent",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card",
                    )}
                  >
                    <RadioGroupItem
                      id={`${current.id}-${o.key}`}
                      value={o.key}
                      className="mt-0.5"
                    />
                    <span className="font-normal leading-relaxed">
                      <span className="mr-1 font-mono text-sm text-muted-foreground">
                        {o.key}.
                      </span>
                      {o.text}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          ) : (
            <Textarea
              rows={4}
              placeholder="Type your answer..."
              value={answers[current.id] ?? ""}
              onChange={(e) => setAnswer(current.id, e.target.value)}
              className="min-h-32"
            />
          )}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not submit</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={prev}
          disabled={index === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {navItems.map((item) => {
            if (item.type === "ellipsis") {
              return (
                <span
                  key={item.key}
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 items-center justify-center text-xs"
                >
                  ...
                </span>
              );
            }

            const i = item.index;
            const qid = questions[i].id;
            const isCurrent = i === index;
            const isAnswered = (answers[qid] ?? "").trim().length > 0;
            return (
              <button
                key={qid}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to question ${i + 1}`}
                className={cn(
                  "h-7 w-7 rounded-md border text-xs font-medium transition-colors",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isAnswered
                      ? "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300"
                      : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        {index + 1 < total ? (
          <Button onClick={next} className="gap-2">
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={pending} className="gap-2">
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit quiz
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
