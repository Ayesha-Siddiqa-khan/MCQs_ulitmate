"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileQuestion,
  Sparkles,
  Type,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Play,
  Info,
} from "lucide-react";

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
  type Question,
  type QuestionSet,
  type ExtractExistingMCQsResponse,
  type ExtractPreviewResponse,
} from "@/lib/types";

const difficultyOptions: Difficulty[] = ["easy", "medium", "hard"];
const ANSWER_KEYS = ["A", "B", "C", "D", "E", "F", "G"] as const;

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

  // Unsolved MCQ state
  const [extractedResult, setExtractedResult] = useState<ExtractExistingMCQsResponse | null>(null);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState(false);

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
    setExtractedResult(null);
    startTransition(async () => {
      try {
        const qs = await api<ExtractExistingMCQsResponse>("/question-sets/extract-existing-mcqs", {
          json: {
            material_id: material.id,
            title: `${material.title} - extracted practice`,
          },
        });
        setExtractedResult(qs);
        if (qs.answers_missing > 0) {
          // Show the unsolved MCQ banner — don't navigate yet
          return;
        }
        router.push(`/quiz-sets/${qs.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function onStartPracticeWithoutAnswers() {
    if (extractedResult) {
      router.push(`/quiz-sets/${extractedResult.id}`);
    }
  }

  function onOpenAnswerEditor() {
    if (!extractedResult) return;
    const initial: Record<string, string> = {};
    for (const q of extractedResult.questions) {
      initial[q.id] = q.correct_answer ?? "";
    }
    setAnswers(initial);
    setAnswersOpen(true);
  }

  async function onSaveAnswers() {
    if (!extractedResult) return;
    setSavingAnswers(true);
    setError(null);
    try {
      const answerMap: Record<string, string | null> = {};
      for (const [qid, ans] of Object.entries(answers)) {
        answerMap[qid] = ans || null;
      }
      await api(`/question-sets/${extractedResult.id}/answers`, {
        method: "POST",
        json: { answers: answerMap },
      });
      setAnswersOpen(false);
      router.push(`/quiz-sets/${extractedResult.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingAnswers(false);
    }
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
          {pending ? "Reading MCQs..." : "Extract MCQs"}
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
                Uses your saved AI key from Settings. For MCQ PDFs, use Extract MCQs
                instead so the app reads the original questions.
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
          Extract text first, then use Extract MCQs for PDFs that already contain questions.
        </p>
      ) : null}

      {/* Preview MCQs card */}
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
              </div>
            )}

            {/* Answer source breakdown */}
            {preview.answer_sources && Object.keys(preview.answer_sources).length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Answer detection breakdown:</p>
                <div className="flex flex-wrap gap-1">
                  {preview.answer_sources.explicit_answer_key && (
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Answer key: {preview.answer_sources.explicit_answer_key}
                    </Badge>
                  )}
                  {preview.answer_sources.bold_format && (
                    <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-700">
                      <Eye className="h-3 w-3 mr-1" />
                      Bold/format: {preview.answer_sources.bold_format}
                    </Badge>
                  )}
                  {preview.answer_sources.url_marker && (
                    <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-700">
                      URL marker: {preview.answer_sources.url_marker}
                    </Badge>
                  )}
                  {preview.answer_sources.inline_answer && (
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Inline: {preview.answer_sources.inline_answer}
                    </Badge>
                  )}
                  {preview.answer_sources.format_uncertain && (
                    <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-700">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Uncertain: {preview.answer_sources.format_uncertain}
                    </Badge>
                  )}
                  {preview.answer_sources.missing && (
                    <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-700">
                      Missing: {preview.answer_sources.missing}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Unsolved MCQs banner */}
      {extractedResult && extractedResult.answers_missing > 0 ? (
        <Card className="border-2 border-orange-400/50 bg-orange-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-orange-500" />
              MCQs found, but no answer key detected
            </CardTitle>
            <CardDescription>
              We found {extractedResult.total_questions} question(s) with{" "}
              {extractedResult.answers_detected} answer(s).{" "}
              {extractedResult.answers_missing} question(s) are missing answers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You can still practice without answer checking, or add answers manually
              to enable auto-grading.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onStartPracticeWithoutAnswers}>
                <Play className="mr-2 h-3.5 w-3.5" />
                Practice without checking answers
              </Button>
              <Button size="sm" variant="outline" onClick={onOpenAnswerEditor}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Add answers manually
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/quiz-sets/${extractedResult.id}`)}
              >
                View questions
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Manual answer entry dialog */}
      <Dialog open={answersOpen} onOpenChange={setAnswersOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add answers manually</DialogTitle>
            <DialogDescription>
              Select the correct answer (A-G) for each question. Leave blank to skip.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {extractedResult?.questions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-3 rounded-lg border p-3">
                <span className="text-sm font-medium text-muted-foreground shrink-0 mt-0.5">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{q.question_text}</p>
                  {q.options.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.options.map((o) => `${o.key}) ${o.text}`).join(" | ")}
                    </p>
                  )}
                </div>
                <Select
                  value={answers[q.id] ?? ""}
                  onValueChange={(v) => {
                    const val = v === "__skip__" ? "" : v;
                    setAnswers((prev) => ({ ...prev, [q.id]: val }));
                  }}
                >
                  <SelectTrigger className="w-20 shrink-0">
                    <SelectValue placeholder="?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">Skip</SelectItem>
                    {ANSWER_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnswersOpen(false)} disabled={savingAnswers}>
              Cancel
            </Button>
            <Button onClick={onSaveAnswers} disabled={savingAnswers}>
              {savingAnswers ? "Saving..." : "Save answers & start practice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not create questions</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
