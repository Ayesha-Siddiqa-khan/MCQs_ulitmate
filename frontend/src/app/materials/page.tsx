import { FileText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { MaterialsBrowser } from "@/app/materials/materials-browser";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type PaginatedMaterials, type MaterialUsage } from "@/lib/types";

export default async function MaterialsPage() {
  await requireUser();
  let materials: PaginatedMaterials = { items: [], total: 0, page: 1, page_size: 20, total_pages: 1 };
  let usage: MaterialUsage = { used: 0, limit: 5, remaining: 5 };
  let error: string | null = null;
  try {
    materials = await api<PaginatedMaterials>("/materials");
    usage = await api<MaterialUsage>("/materials/usage");
  } catch (e) {
    error = (e as Error).message;
    usage = { used: materials.total, limit: 5, remaining: Math.max(0, 5 - materials.total) };
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

      <MaterialsBrowser materials={materials} usage={usage} />
    </main>
  );
}
