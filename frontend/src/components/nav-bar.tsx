"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, LogOut, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/materials", label: "Materials" },
  { href: "/mistakes", label: "Mistakes" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar({ user }: { user: AuthUser | null }) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  const homeHref = user ? "/dashboard" : "/";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href={homeHref}
          className="flex items-center gap-2"
          aria-label="MCQ Mentor home"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-600 text-primary-foreground shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight hidden sm:inline-block">
            MCQ Mentor
          </span>
        </Link>

        {user ? (
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {active ? (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 -z-10 rounded-md bg-muted"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <>
              <form action={signOutAction} className="hidden sm:block">
                <Button type="submit" variant="ghost" size="sm" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Toggle menu"
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
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

      <AnimatePresence>
        {mobileOpen && user ? (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden overflow-hidden border-t"
          >
            <div className="space-y-1 px-4 py-3">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <form action={signOutAction} className="pt-2 border-t mt-2">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
