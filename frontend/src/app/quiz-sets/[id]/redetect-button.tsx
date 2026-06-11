"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

interface RedetectResult {
  set_id: string;
  questions_updated: number;
  answers_detected: number;
  answers_unchanged: number;
}

export function RedetectButton({ setId }: { setId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RedetectResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRedetect() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api<RedetectResult>(`/question-sets/${setId}/redetect-answers`, {
        method: "POST",
      });
      setResult(res);
      if (res.questions_updated > 0) {
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span>
          Redetected {result.questions_updated} answer(s) from formatting.
          {result.answers_unchanged > 0 && ` ${result.answers_unchanged} already had answers.`}
        </span>
        <Button size="sm" variant="outline" onClick={() => router.refresh()}>
          Refresh page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={onRedetect} disabled={loading}>
        <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Detecting answers..." : "Auto-detect answers from PDF formatting"}
      </Button>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
