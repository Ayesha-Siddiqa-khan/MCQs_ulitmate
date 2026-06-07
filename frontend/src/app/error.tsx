"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-red-500/5 text-red-500">
        <AlertOctagon className="h-7 w-7" />
      </div>
      <Card className="border-2 w-full">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            {error.message || "An unexpected error occurred."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => reset()} className="gap-2">
            <RotateCw className="h-4 w-4" /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
