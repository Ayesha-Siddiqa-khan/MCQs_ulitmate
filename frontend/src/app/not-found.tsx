import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="container mx-auto px-4 py-16 text-center space-y-3">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
