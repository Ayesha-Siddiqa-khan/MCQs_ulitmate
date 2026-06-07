"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteStudentDataAction } from "@/app/actions/settings";
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
import { type DeleteStudentDataResponse } from "@/lib/types";

const deletedLabels: Record<string, string> = {
  learning_materials: "materials",
  question_sets: "question sets",
  questions: "questions",
  quiz_attempts: "quiz attempts",
  question_attempts: "question answers",
  mistake_bank: "mistake bank rows",
  practice_sessions: "practice sessions",
};

export function DeleteStudentData() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeleteStudentDataResponse | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const response = await deleteStudentDataAction(confirm);
      if (response?.error) {
        setError(response.error);
        return;
      }
      if (response?.data) {
        setResult(response.data);
        setConfirm("");
        setOpen(false);
      }
    });
  }

  const totalDeleted = result
    ? Object.values(result.deleted).reduce((total, count) => total + count, 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Remove this student&apos;s materials, extracted questions, quiz attempts, practice
          sessions, and mistake history. The account and AI key stay in place.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete old study data
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete old study data?</DialogTitle>
              <DialogDescription>
                This clears the current student&apos;s study data only. It cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
              <Input
                id="delete-confirm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="off"
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Could not delete data</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={pending || confirm !== "DELETE"}>
                {pending ? "Deleting..." : "Delete data"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {result ? (
        <Alert>
          <AlertTitle>Study data deleted</AlertTitle>
          <AlertDescription>
            <p>{totalDeleted} database rows removed.</p>
            <p>{result.storage_paths_removed} stored material files removed.</p>
            {result.warning ? <p>{result.warning}</p> : null}
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(result.deleted).map(([table, count]) => (
                <li key={table}>
                  {deletedLabels[table] ?? table}: {count}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
