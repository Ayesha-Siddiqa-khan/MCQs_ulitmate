"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { type StartQuizResponse } from "@/lib/types";

export function StartAttemptButton({ setId }: { setId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const resp = await api<StartQuizResponse>("/quiz-attempts/start", {
          json: { question_set_id: setId, mode: "practice" },
        });
        router.push(`/quiz/${resp.attempt_id}?setId=${encodeURIComponent(setId)}`);
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
