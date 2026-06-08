"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Sparkles, Type, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import {
  type Difficulty,
  type Material,
  type QuestionSet,
  type QuestionSetDetail,
  type ExtractPreviewResponse,
} from "@/lib/types";

const difficultyOptions: Difficulty[] = ["easy", "medium", "hard"];

function confidenceColor(confidence: string): string {
  if (confidence === "high") return "bg-green-500 text-white hover:bg-green-500/90";
  if (confidence === "medium") return "bg-yellow-500 text-white hover:bg-yellow-500/90";
  if (confidence === "low") return "bg-orange-500 text-white hover:bg-orange-500/90";
  return "bg-red-500 text-white hover:bg-red-500/90";
}

export function MaterialActions({ material }: { material: Material }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ExtractPreviewResponse | null>(null);
  const [previewPending, startPreviewTransition] = useTransition();

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

  function onExtractPreview() {
    setError(null);
    setPreview(null);
    startPreviewTransition(async () => {
      try {
        const result = await api<ExtractPreviewResponse>(
          `/materials/${material.id}/extract-preview`,
          { method: "POST" }
        );
        setPreview(result);
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

        {hasExtractedText && (
          <Button variant="outline" onClick={onExtractPreview} disabled={previewPending}>
            <Eye className="mr-2 h-4 w-4" />
            {previewPending ? "Analyzing..." : "Preview MCQs"}
          </Button>
        )}

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

      {preview ? (
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-primary" />
              MCQ Extraction Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{preview.total_detected} detected</Badge>
              <Badge className="bg-green-500 text-white hover:bg-green-500/90">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {preview.with_answers} with answers
              </Badge>
              {preview.without_answers > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  {preview.without_answers} missing answers
                </Badge>
              )}
              {preview.with_explanations > 0 && (
                <Badge variant="outline">{preview.with_explanations} with explanations</Badge>
              )}
              {preview.duplicates > 0 && (
                <Badge variant="outline" className="text-red-600">
                  {preview.duplicates} duplicates
                </Badge>
              )}
              <Badge className={confidenceColor(preview.confidence)}>
                {preview.confidence} confidence
              </Badge>
            </div>

            {preview.warnings.length > 0 && (
              <div className="space-y-1">
                {preview.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{w}</span>
                  </div>
                ))}
              </div>
            )}

            {preview.total_detected > 0 && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={onExtractExisting} disabled={pending}>
                  <FileQuestion className="mr-2 h-3.5 w-3.5" />
                  Extract & start practice
                </Button>
                {preview.without_answers === 0 && (
                  <Button size="sm" variant="outline" onClick={onExtractExisting} disabled={pending}>
                    Review questions first
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
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
