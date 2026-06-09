import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you are looking for does not exist, or it moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
