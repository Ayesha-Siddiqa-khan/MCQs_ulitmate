"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { type MistakeFilter, type StartPracticeResponse } from "@/lib/types";

export function PracticeStartForm() {
  const router = useRouter();
  const [limit, setLimit] = useState(20);
  const [onlyUnmastered, setOnlyUnmastered] = useState(true);
  const [onlyRepeated, setOnlyRepeated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onStart() {
    setError(null);
    const filter: MistakeFilter = {
      limit,
      only_unmastered: onlyUnmastered,
      only_repeated: onlyRepeated,
      session_type: onlyRepeated
        ? "mistakes_repeated"
        : onlyUnmastered
          ? "mistakes_unmastered"
          : "mistakes_all",
    };
    startTransition(async () => {
      try {
        const resp = await api<StartPracticeResponse>("/mistakes/practice-session", {
          json: { filter },
        });
        router.push(
          `/quiz/${resp.quiz_attempt_id}?setId=${encodeURIComponent(resp.question_set_id)}`,
        );
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
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyUnmastered}
              onChange={(e) => setOnlyUnmastered(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Only unmastered</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyRepeated}
              onChange={(e) => setOnlyRepeated(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Only repeated mistakes</span>
          </label>
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
