import { FilePlus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { MaterialNewForm } from "@/app/materials/new/new-form";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type MaterialUsage } from "@/lib/types";

export default async function NewMaterialPage() {
  await requireUser();
  const usage = await api<MaterialUsage>("/materials/usage").catch(
    () => ({ used: 0, limit: 2, remaining: 2 }) satisfies MaterialUsage,
  );
  const isAtLimit = usage.used >= usage.limit;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Add material"
        description={`${usage.used} of ${usage.limit} materials used. Upload a PDF/DOCX or paste text.`}
        icon={FilePlus}
      />
      {isAtLimit ? (
        <Card className="border-2 border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            You have reached the {usage.limit}-material limit. Delete an older material before uploading a new one.
          </CardContent>
        </Card>
      ) : (
        <MaterialNewForm usage={usage} />
      )}
    </main>
  );
}
