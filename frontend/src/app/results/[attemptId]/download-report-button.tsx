"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiBase } from "@/lib/api-shared";

interface DownloadReportButtonProps {
  attemptId: string;
  disabled?: boolean;
}

export function DownloadReportButton({ attemptId, disabled }: DownloadReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const base = getApiBase();
      const url = `${base}/quiz-attempts/${attemptId}/report.pdf`;

      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        let detail = `Failed to download report (${res.status})`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.detail) detail = parsed.detail;
        } catch {
          // use default
        }
        throw new Error(detail);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      let filename = `mcq-mentor-result-${attemptId}.pdf`;
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      if (match?.[1]) {
        filename = match[1];
      }

      const link = window.document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleDownload}
        disabled={loading || disabled}
        variant="outline"
        size="sm"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {loading ? "Generating PDF..." : "Download PDF Report"}
      </Button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
