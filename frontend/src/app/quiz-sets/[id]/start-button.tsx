"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { type QuizAttempt } from "@/lib/types";

export function StartAttemptButton({ setId }: { setId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const a = await api<QuizAttempt>("/quiz-attempts", {
          json: { question_set_id: setId },
        });
        router.push(`/quiz/${a.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <>
      <Button onClick={onClick} disabled={pending}>
        {pending ? "Starting..." : "Start quiz"}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not start</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
