"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/materials", label: "Materials" },
  { href: "/mistakes", label: "Mistakes" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const [user, setUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

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
            <Button variant="ghost" size="sm" onClick={signOut} disabled={pending}>
              Sign out
            </Button>
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
