"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        router.push(`/results/${r.attempt_id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (!current) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          This quiz has no questions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {index + 1} of {total}
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-lg font-medium">{current.question_text}</p>
          {current.options.length > 0 ? (
            <RadioGroup
              value={answers[current.id] ?? ""}
              onValueChange={(v) => setAnswer(current.id, v)}
            >
              {current.options.map((o) => (
                <div key={o.key} className="flex items-start gap-3 p-2 rounded hover:bg-muted">
                  <RadioGroupItem id={`${current.id}-${o.key}`} value={o.key} />
                  <Label htmlFor={`${current.id}-${o.key}`} className="font-normal cursor-pointer">
                    <span className="font-mono mr-1">{o.key}.</span> {o.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <Textarea
              rows={4}
              placeholder="Type your answer..."
              value={answers[current.id] ?? ""}
              onChange={(e) => setAnswer(current.id, e.target.value)}
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

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={prev} disabled={index === 0}>
          Previous
        </Button>
        {index + 1 < total ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={submit} disabled={pending}>
            {pending ? "Submitting..." : "Submit quiz"}
          </Button>
        )}
      </div>
    </div>
  );
}
