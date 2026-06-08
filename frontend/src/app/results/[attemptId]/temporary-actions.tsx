"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, AlertTriangle } from "lucide-react";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

interface TemporarySessionActionsProps {
  materialId: string;
  attemptId: string;
}

export function TemporarySessionActions({ materialId, attemptId }: TemporarySessionActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [actioned, setActioned] = useState(false);

  function onSave() {
    setError(null);
    startTransition(async () => {
      try {
        await api(`/materials/${materialId}/save-temporary`, {
          json: { save_mode: "save_material" },
        });
        setActioned(true);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function onSaveMistakesOnly() {
    setError(null);
    startTransition(async () => {
      try {
        await api(`/materials/${materialId}/save-temporary`, {
          json: { save_mode: "save_mistakes_only" },
        });
        setActioned(true);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function onDiscard() {
    setError(null);
    startTransition(async () => {
      try {
        await api(`/materials/${materialId}/save-temporary`, {
          json: { save_mode: "discard" },
        });
        setActioned(true);
        router.push("/dashboard");
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (actioned) {
    return (
      <Alert className="border-green-500/40 bg-green-500/5">
        <AlertTitle>Session handled</AlertTitle>
        <AlertDescription>
          Your temporary session has been processed.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-2 border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Temporary practice session
        </CardTitle>
        <CardDescription>
          This material was practiced without saving. Choose what to do with your results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={pending} size="sm">
            <Save className="mr-2 h-3.5 w-3.5" />
            Save material & results
          </Button>

          <Button onClick={onSaveMistakesOnly} disabled={pending} size="sm" variant="outline">
            Save mistakes only
          </Button>

          <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={pending}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Discard everything
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Discard temporary session?</DialogTitle>
                <DialogDescription>
                  This will permanently delete the uploaded material, quiz attempts, and all
                  associated data. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDiscardOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={onDiscard} disabled={pending}>
                  {pending ? "Discarding..." : "Yes, discard everything"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <p className="text-xs text-muted-foreground">
          Saving counts toward your material limit. Mistakes are kept for future practice even if you don't save the full material.
        </p>
      </CardContent>
    </Card>
  );
}
