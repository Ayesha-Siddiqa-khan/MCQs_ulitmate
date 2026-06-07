"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Sparkles, Type } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import {
  type Difficulty,
  type Material,
  type QuestionSet,
  type QuestionSetDetail,
} from "@/lib/types";

const difficultyOptions: Difficulty[] = ["easy", "medium", "hard"];

export function MaterialActions({ material }: { material: Material }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasExtractedText = material.status === "extracted" || material.status === "manual";
  const canExtractText = material.status === "uploaded" || material.status === "failed";

  function onExtractText() {
    setError(null);
    startTransition(async () => {
      try {
        await api(`/materials/${material.id}/extract-text`, { method: "POST" });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function onExtractExisting() {
    setError(null);
    startTransition(async () => {
      try {
        const qs = await api<QuestionSetDetail>("/question-sets/extract-existing-mcqs", {
          json: {
            material_id: material.id,
            title: `${material.title} - extracted practice`,
          },
        });
        router.push(`/quiz-sets/${qs.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function onGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const qs = await api<QuestionSet>("/question-sets/generate", {
          json: {
            material_id: material.id,
            title: `${material.title} - AI MCQs`,
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canExtractText ? (
          <Button variant="outline" onClick={onExtractText} disabled={pending}>
            <Type className="mr-2 h-4 w-4" />
            {material.status === "failed" ? "Retry extraction" : "Extract text"}
          </Button>
        ) : null}

        <Button variant="outline" onClick={onExtractExisting} disabled={!hasExtractedText || pending}>
          <FileQuestion className="mr-2 h-4 w-4" />
          {pending ? "Reading MCQs..." : "Extract solved MCQs"}
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!hasExtractedText}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate MCQs
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate questions</DialogTitle>
              <DialogDescription>
                Uses your saved AI key from Settings. For solved MCQ PDFs, use Extract solved MCQs
                instead so the app reads the original questions and answer key.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="count">How many questions?</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) =>
                    setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
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

      {!hasExtractedText ? (
        <p className="text-sm text-muted-foreground">
          Extract text first, then use Extract solved MCQs for PDFs that already contain questions
          and an answer key.
        </p>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not create questions</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
