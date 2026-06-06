"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Type } from "lucide-react";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Difficulty,
  type Material,
  type QuestionSet,
} from "@/lib/types";

const difficultyOptions: Difficulty[] = ["easy", "medium", "hard"];

export function MaterialActions({ material }: { material: Material }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canGenerate = material.status === "extracted" || material.status === "manual";
  const canExtract = material.status === "uploaded" || material.status === "failed";

  function onGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const qs = await api<QuestionSet>("/question-sets/generate-mcq", {
          json: {
            material_id: material.id,
            title: `${material.title} — AI MCQs`,
            count,
            difficulty,
            mode: "generate_mcq",
          },
        });
        setOpen(false);
        router.push(`/quiz-sets/${qs.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canExtract ? (
        <Button
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              try {
                await api(`/materials/${material.id}/extract-text`, { method: "POST" });
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            })
          }
          disabled={pending}
        >
          <Type className="h-4 w-4 mr-2" />
          {material.status === "failed" ? "Retry extraction" : "Re-extract text"}
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button disabled={!canGenerate}>
            <Sparkles className="h-4 w-4 mr-2" /> Generate MCQs
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate questions</DialogTitle>
            <DialogDescription>
              Uses your saved AI key (configured in Settings). If you don&apos;t have a key saved,
              you&apos;ll get a clear error.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not generate</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="count">How many questions?</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as Difficulty)}
              >
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {difficultyOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={onGenerate} disabled={pending}>
              {pending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
