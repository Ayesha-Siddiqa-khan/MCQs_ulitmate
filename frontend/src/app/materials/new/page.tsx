import Link from "next/link";

import { MaterialNewForm } from "@/app/materials/new/new-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export default async function NewMaterialPage() {
  await requireUser();
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <div>
          <Link href="/materials" className="text-sm text-muted-foreground hover:underline">
            ← Materials
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">Add material</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Upload or paste</CardTitle>
            <CardDescription>
              For PDFs and DOCX, text extraction runs after upload. You will be redirected to the
              material page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MaterialNewForm />
          </CardContent>
        </Card>
      </main>
  );
}
