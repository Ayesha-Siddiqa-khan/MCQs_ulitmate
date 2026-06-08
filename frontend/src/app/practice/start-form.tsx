"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api-client";
import { ApiCallError } from "@/lib/api-shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { type Mistake, type MistakeFilter, type StartPracticeResponse } from "@/lib/types";

function matchesFilter(m: Mistake, onlyUnmastered: boolean, onlyRepeated: boolean): boolean {
  if (onlyUnmastered && m.mastery_status === "mastered") return false;
  if (onlyRepeated && m.wrong_count < 2) return false;
  return true;
}

function buildEmptyMessage(onlyUnmastered: boolean, onlyRepeated: boolean, total: number): {
  title: string;
  body: string;
} {
  if (total === 0) {
    return {
      title: "No mistakes yet",
      body: "Take a quiz first — your wrong answers will land here automatically.",
    };
  }
  if (onlyRepeated) {
    return {
      title: "No repeated mistakes",
      body: "You haven't gotten the same question wrong twice yet. Uncheck \u201COnly repeated mistakes\u201D to practice everything you've missed.",
    };
  }
  if (onlyUnmastered) {
    const allMastered = true;
    return {
      title: "Everything is mastered",
      body: allMastered
        ? "Every mistake in your bank is already mastered. Uncheck \u201COnly unmastered\u201D to keep practicing them, or take a new quiz for fresh material."
        : "No unmastered mistakes match this filter. Uncheck \u201COnly unmastered\u201D to include mastered ones.",
    };
  }
  return {
    title: "No mistakes match this filter",
    body: "Try relaxing the filters above.",
  };
}

export function PracticeStartForm() {
  const router = useRouter();
  const [limit, setLimit] = useState(20);
  const [onlyUnmastered, setOnlyUnmastered] = useState(true);
  const [onlyRepeated, setOnlyRepeated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Mistake[]>("/mistakes", { query: { only_unmastered: false } })
      .then((rows) => {
        if (!cancelled) setMistakes(rows);
      })
      .catch(() => {
        if (!cancelled) setMistakes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matchCount = useMemo(() => {
    if (!mistakes) return null;
    return mistakes.filter((m) => matchesFilter(m, onlyUnmastered, onlyRepeated)).length;
  }, [mistakes, onlyUnmastered, onlyRepeated]);

  const emptyState = useMemo(() => {
    if (matchCount === null || matchCount > 0) return null;
    return buildEmptyMessage(onlyUnmastered, onlyRepeated, mistakes?.length ?? 0);
  }, [matchCount, onlyUnmastered, onlyRepeated, mistakes]);

  const isOnlyUnmasteredBlocking = !!emptyState && onlyUnmastered && (mistakes?.length ?? 0) > 0;
  const isOnlyRepeatedBlocking = !!emptyState && onlyRepeated && (mistakes?.length ?? 0) > 0;

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
          json: filter,
        });
        router.push(
          `/quiz/${resp.quiz_attempt_id}`,
        );
      } catch (e) {
        if (e instanceof ApiCallError && e.status === 404) {
          setError(
            "No mistakes match this filter right now. Try relaxing the filters above.",
          );
          return;
        }
        setError((e as Error).message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice your mistakes</CardTitle>
        <CardDescription>
          Pulls the questions you&apos;ve gotten wrong most often into a new quiz. Mastery updates
          after you submit the practice attempt.
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

        {mistakes !== null ? (
          <p className="text-xs text-muted-foreground">
            {matchCount} of {mistakes.length} mistake{mistakes.length === 1 ? "" : "s"} match the
            current filter.
          </p>
        ) : null}

        {emptyState ? (
          <Alert>
            <AlertTitle>{emptyState.title}</AlertTitle>
            <AlertDescription>
              <span>{emptyState.body}</span>
              {isOnlyUnmasteredBlocking ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setOnlyUnmastered(false)}
                  >
                    Clear filter
                  </button>
                  .
                </>
              ) : null}
              {isOnlyRepeatedBlocking ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setOnlyRepeated(false)}
                  >
                    Clear filter
                  </button>
                  .
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not start</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          onClick={onStart}
          disabled={pending || matchCount === 0}
        >
          {pending ? "Building..." : "Build practice quiz"}
        </Button>
      </CardContent>
    </Card>
  );
}
