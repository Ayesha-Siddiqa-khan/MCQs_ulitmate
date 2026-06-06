// Server component shell of the top navigation. The user is fetched
// from the FastAPI backend (no Supabase in the browser / frontend bundle).

import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/materials", label: "Materials" },
  { href: "/mistakes", label: "Mistakes" },
  { href: "/settings", label: "Settings" },
];

export async function AppNav() {
  const user = await getCurrentUser();

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"} className="font-semibold tracking-tight">
            MCQ Mentor
          </Link>
          {user ? (
            <nav className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
