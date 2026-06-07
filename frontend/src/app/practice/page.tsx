import { Brain } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PracticeStartForm } from "@/app/practice/start-form";
import { requireUser } from "@/lib/auth";

export default async function PracticePage() {
  await requireUser();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Practice"
        description="Build a new quiz from your open mistakes, then take it like any other quiz."
        icon={Brain}
      />
      <PracticeStartForm />
    </main>
  );
}
