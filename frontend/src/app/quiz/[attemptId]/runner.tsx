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
import { type Question, type QuizResult } from "@/lib/types";

export function QuizRunner({ attemptId, questions }: { attemptId: string; questions: Question[] }) {
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
    startTransition(async () => {
      try {
        const r = await api<QuizResult>(`/quiz-attempts/${attemptId}/submit`, {
          method: "POST",
          json: {
            answers: questions.map((q) => ({
              question_id: q.id,
              selected_answer: answers[q.id] ?? null,
            })),
          },
        });
        router.replace(`/results/${r.attempt_id}`);
      } catch (e) {
        if (e instanceof ApiCallError && e.status === 409) {
          router.replace(`/results/${attemptId}`);
          return;
        }
        setError((e as Error).message);
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
          {Array.from({ length: total }).map((_, i) => {
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
