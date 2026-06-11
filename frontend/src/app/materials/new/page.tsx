import { FilePlus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { MaterialNewForm } from "@/app/materials/new/new-form";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type MaterialUsage } from "@/lib/types";

export default async function NewMaterialPage() {
  await requireUser();
  const usage = await api<MaterialUsage>("/materials/usage").catch(
    () => ({ used: 0, limit: 2, remaining: 2 }) satisfies MaterialUsage,
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Add material"
        description="Upload a file or paste text to start practicing."
        icon={FilePlus}
      />
      <MaterialNewForm usage={usage} />
    </main>
  );
}
