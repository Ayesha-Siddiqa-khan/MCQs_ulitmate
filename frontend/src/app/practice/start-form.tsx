"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { type PracticeSession, type QuestionSet } from "@/lib/types";

export function PracticeStartForm() {
  const router = useRouter();
  const [limit, setLimit] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onStart() {
    setError(null);
    startTransition(async () => {
      try {
        const sess = await api<PracticeSession>("/mistakes/practice", {
          json: { limit },
        });
        // Backend returns session with question_set_id; route to a generated set view.
        // We synthesize a transient quiz-set page by looking up the set first.
        const qs = await api<QuestionSet>(`/question-sets/${sess.question_set_id}`);
        router.push(`/quiz-sets/${qs.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice your mistakes</CardTitle>
        <CardDescription>
          Pulls the questions you&apos;ve gotten wrong most often into a new quiz. The set is
          ephemeral — your original mistake bank isn&apos;t touched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="limit">How many questions?</Label>
          <input
            id="limit"
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          />
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not start</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button onClick={onStart} disabled={pending}>
          {pending ? "Building..." : "Build practice quiz"}
        </Button>
      </CardContent>
    </Card>
  );
}
