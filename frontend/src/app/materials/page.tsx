import { FileText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { MaterialsBrowser } from "@/app/materials/materials-browser";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type Material } from "@/lib/types";

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
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Materials"
        description="Upload study material or paste text. You can generate questions from any of these."
        icon={FileText}
      />

      {error ? (
        <Card className="border-2 border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Could not reach the API: {error}
          </CardContent>
        </Card>
      ) : null}

      <MaterialsBrowser materials={materials} />
    </main>
  );
}
