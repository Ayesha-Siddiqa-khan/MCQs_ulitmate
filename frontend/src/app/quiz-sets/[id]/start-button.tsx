"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, ListFilter, Play } from "lucide-react";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type StartQuizResponse } from "@/lib/types";

type CountMode = "all" | "10" | "20" | "30" | "custom";

export interface SetupQuestion {
  id: string;
  chapter: string | null;
  topic: string | null;
}

interface FilterOption {
  value: string;
  label: string;
  chapter?: string;
  topic?: string;
  count: number;
}

const ALL_FILTER = "all";

function clean(value: string | null | undefined): string {
  return (value || "").trim();
}

function buildFilterOptions(questions: SetupQuestion[]): FilterOption[] {
  const map = new Map<string, FilterOption>();

  for (const q of questions) {
    const chapter = clean(q.chapter);
    if (chapter) {
      const value = `chapter:${chapter}`;
      const existing = map.get(value);
      map.set(value, {
        value,
        label: `Chapter: ${chapter}`,
        chapter,
        count: (existing?.count ?? 0) + 1,
      });
    }

    const topic = clean(q.topic);
    if (topic) {
      const value = `topic:${topic}`;
      const existing = map.get(value);
      map.set(value, {
        value,
        label: `Topic: ${topic}`,
        topic,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function matchesFilter(question: SetupQuestion, filter: FilterOption | null): boolean {
  if (!filter) return true;
  if (filter.chapter) return clean(question.chapter) === filter.chapter;
  if (filter.topic) return clean(question.topic) === filter.topic;
  return true;
}

export function StartAttemptButton({
  setId,
  questions,
}: {
  setId: string;
  questions: SetupQuestion[];
}) {
  const router = useRouter();
  const [countMode, setCountMode] = useState<CountMode>(() =>
    questions.length >= 10 ? "10" : "all",
  );
  const [customCount, setCustomCount] = useState(Math.min(10, Math.max(1, questions.length)));
  const [filterValue, setFilterValue] = useState(ALL_FILTER);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filterOptions = useMemo(() => buildFilterOptions(questions), [questions]);
  const selectedFilter = useMemo(
    () => filterOptions.find((option) => option.value === filterValue) ?? null,
    [filterOptions, filterValue],
  );
  const availableQuestions = useMemo(
    () => questions.filter((question) => matchesFilter(question, selectedFilter)),
    [questions, selectedFilter],
  );
  const availableCount = availableQuestions.length;
  const selectedCount =
    countMode === "all"
      ? availableCount
      : countMode === "custom"
        ? customCount
        : Number(countMode);

  const validationError = useMemo(() => {
    if (availableCount === 0) return "No questions are available for this selection.";
    if (!Number.isFinite(selectedCount) || selectedCount <= 0) {
      return "Choose a question count greater than 0.";
    }
    if (selectedCount > availableCount) {
      return `Choose ${availableCount} or fewer questions for this selection.`;
    }
    return null;
  }, [availableCount, selectedCount]);

  function onStart() {
    setError(null);
    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(async () => {
      try {
        const resp = await api<StartQuizResponse>("/quiz-attempts/start", {
          json: {
            question_set_id: setId,
            mode: "practice",
            question_count: selectedCount,
            chapter: selectedFilter?.chapter ?? null,
            topic: selectedFilter?.topic ?? null,
          },
        });
        router.push(`/quiz/${resp.attempt_id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            Choose quiz length
          </div>
          <RadioGroup
            value={countMode}
            onValueChange={(value) => setCountMode(value as CountMode)}
            className="grid gap-2 sm:grid-cols-2"
          >
            {[
              { value: "all" as const, label: "All", helper: `${availableCount} questions` },
              { value: "10" as const, label: "10", helper: "Quick drill" },
              { value: "20" as const, label: "20", helper: "Standard set" },
              { value: "30" as const, label: "30", helper: "Longer practice" },
              { value: "custom" as const, label: "Custom", helper: "Pick a number" },
            ].map((option) => {
              const presetCount =
                option.value === "all"
                  ? availableCount
                  : option.value === "custom"
                    ? customCount
                    : Number(option.value);
              const disabled =
                option.value !== "custom" && option.value !== "all" && presetCount > availableCount;
              return (
                <Label
                  key={option.value}
                  htmlFor={`count-${option.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-accent",
                    countMode === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background/40",
                    disabled ? "cursor-not-allowed opacity-50" : "",
                  )}
                >
                  <RadioGroupItem
                    id={`count-${option.value}`}
                    value={option.value}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.helper}</span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>

          {countMode === "custom" ? (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="custom-count">Custom number of questions</Label>
              <Input
                id="custom-count"
                type="number"
                min={1}
                max={Math.max(1, availableCount)}
                value={customCount}
                onChange={(event) => setCustomCount(Number(event.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Enter a number from 1 to {availableCount}.
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-lg border bg-background/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListFilter className="h-4 w-4 text-primary" />
            Chapter or topic
          </div>
          {filterOptions.length > 0 ? (
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All chapters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All chapters</SelectItem>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              No chapter detected.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-muted/70 p-3">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-xl font-semibold">{availableCount}</p>
            </div>
            <div className="rounded-md bg-muted/70 p-3">
              <p className="text-xs text-muted-foreground">Will load</p>
              <p className="text-xl font-semibold">{validationError ? "-" : selectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {validationError ? (
        <Alert>
          <AlertTitle>Adjust quiz setup</AlertTitle>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not start</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button onClick={onStart} disabled={pending || !!validationError} className="w-full gap-2 sm:w-auto">
        <Play className="h-4 w-4" />
        {pending ? "Starting..." : `Start ${selectedCount} question quiz`}
      </Button>
    </div>
  );
}
