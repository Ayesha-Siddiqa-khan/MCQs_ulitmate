import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type Material, type MaterialStatus } from "@/lib/types";

const statusVariant: Record<MaterialStatus, "default" | "secondary" | "destructive" | "outline"> = {
  uploaded: "secondary",
  extracted: "default",
  failed: "destructive",
  manual: "outline",
};

export default async function MaterialsPage() {
  await requireUser();
  let materials: Material[] = [];
  let error: string | null = null;
  try {
    materials = await api<Material[]>("/materials");
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Materials</h1>
            <p className="text-sm text-muted-foreground">
              Upload study material or paste text. You can generate questions from any of these.
            </p>
          </div>
          <Button asChild>
            <Link href="/materials/new">
              <Plus className="h-4 w-4 mr-2" /> New
            </Link>
          </Button>
        </header>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">API error: {error}</CardContent>
          </Card>
        ) : null}

        {materials.length === 0 && !error ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No materials yet</CardTitle>
              <CardDescription>Add your first piece of study material to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/materials/new">
                  <Plus className="h-4 w-4 mr-2" /> Add material
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.map((m) => (
              <Link
                key={m.id}
                href={`/materials/${m.id}`}
                className="rounded-lg border bg-card text-card-foreground p-4 hover:border-foreground/30 transition-colors flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug line-clamp-2">{m.title}</p>
                  <Badge variant={statusVariant[m.status]}>{m.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground uppercase">{m.file_type}</p>
                {m.size_bytes ? (
                  <p className="text-xs text-muted-foreground">
                    {(m.size_bytes / 1024).toFixed(1)} KB
                  </p>
                ) : null}
                {m.status === "failed" ? (
                  <p className="text-xs text-destructive">Extraction failed</p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </main>
  );
}
