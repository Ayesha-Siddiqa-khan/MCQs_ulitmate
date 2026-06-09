import Link from "next/link";

import type { AuthUser } from "@/lib/auth";

interface SiteFooterProps {
  user: AuthUser | null;
}

export async function SiteFooter({ user }: SiteFooterProps) {
  return (
    <footer className="border-t mt-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
          {user?.email ? (
            <>
              Signed in as{" "}
              <Link href="/settings" className="font-medium hover:underline">
                {user.email}
              </Link>
            </>
          ) : (
            <>Your AI-powered MCQ practice partner.</>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} MCQ Mentor. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
