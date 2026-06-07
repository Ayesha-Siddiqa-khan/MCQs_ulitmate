import { FilePlus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { MaterialNewForm } from "@/app/materials/new/new-form";
import { requireUser } from "@/lib/auth";

export default async function NewMaterialPage() {
  await requireUser();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Add material"
        description="Upload a PDF/DOCX or paste text. We'll extract the text and store it privately."
        icon={FilePlus}
      />
      <MaterialNewForm />
    </main>
  );
}
