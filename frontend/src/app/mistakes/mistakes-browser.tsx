"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Filter, ListChecks, Play, RotateCcw, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  MasteryBadge,
  MASTERY_DESCRIPTION,
  MASTERY_ICON,
  MASTERY_LABEL,
  masteryIconTone,
  masteryTone,
} from "@/components/mastery-badge";
import { containerVariants, itemVariants } from "@/components/motion-presets";
import { cn } from "@/lib/utils";
import type { MasteryStatus, Mistake } from "@/lib/types";

const STATUS_ORDER: MasteryStatus[] = [
  "new_mistake",
  "needs_practice",
  "improving",
  "mastered",
];

interface MistakesBrowserProps {
  mistakes: Mistake[];
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MistakesBrowser({ mistakes }: MistakesBrowserProps) {
  const [active, setActive] = useState<MasteryStatus | "all">("all");

  const counts = useMemo(() => {
    const acc: Record<MasteryStatus, number> = {
      new_mistake: 0,
      needs_practice: 0,
      improving: 0,
      mastered: 0,
    };
    for (const m of mistakes) acc[m.mastery_status] += 1;
    return acc;
  }, [mistakes]);

  const filtered = useMemo(() => {
    if (active === "all") return mistakes;
    return mistakes.filter((m) => m.mastery_status === active);
  }, [mistakes, active]);

  const grouped = useMemo(() => {
    const map: Record<MasteryStatus, Mistake[]> = {
      new_mistake: [],
      needs_practice: [],
      improving: [],
      mastered: [],
    };
    for (const m of filtered) map[m.mastery_status].push(m);
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {STATUS_ORDER.map((status) => {
          const Icon = MASTERY_ICON[status];
          const isActive = active === status;
          return (
            <motion.button
              key={status}
              variants={itemVariants}
              type="button"
              onClick={() => setActive(isActive ? "all" : status)}
              className={cn(
                "group text-left rounded-xl border-2 bg-gradient-to-br p-4 transition-all hover:scale-[1.02]",
                masteryTone(status),
                isActive ? "ring-2 ring-foreground/40 shadow-md" : "",
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className={cn("h-6 w-6", masteryIconTone(status))} />
                <span className="text-3xl font-semibold">{counts[status]}</span>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider">
                  {MASTERY_LABEL[status]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {MASTERY_DESCRIPTION[status]}
                </p>
              </div>
            </motion.button>
          );
        })}
      </motion.section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter
          </span>
          <Pill
            active={active === "all"}
            onClick={() => setActive("all")}
            tone="bg-muted text-foreground"
          >
            All ({mistakes.length})
          </Pill>
          {STATUS_ORDER.map((status) => (
            <Pill
              key={status}
              active={active === status}
              onClick={() => setActive(active === status ? "all" : status)}
              tone="bg-muted text-foreground"
            >
              {MASTERY_LABEL[status]} ({counts[status]})
            </Pill>
          ))}
        </div>
        {active !== "all" ? (
          <Button variant="ghost" size="sm" onClick={() => setActive("all")}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear filter
          </Button>
        ) : null}
      </div>

      {mistakes.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No mistakes yet"
          description="Take a quiz first. Wrong answers will show up here automatically."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={`No ${MASTERY_LABEL[active as MasteryStatus].toLowerCase()} questions`}
          description="Try a different filter to see other mistakes."
          action={
            <Button variant="outline" onClick={() => setActive("all")}>
              Show all
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map((status) => {
            const list = grouped[status];
            if (list.length === 0) return null;
            return (
              <section key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider">
                    {MASTERY_LABEL[status]}
                  </h2>
                  <Badge variant="outline">{list.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {list.map((m) => (
                    <li key={m.id}>
                      <MistakeRow mistake={m} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
        active
          ? "bg-foreground text-background border-transparent"
          : `${tone} hover:bg-accent border-border`,
      )}
    >
      {children}
    </button>
  );
}

function MistakeRow({ mistake }: { mistake: Mistake }) {
  const q = mistake.question;
  return (
    <div className="rounded-xl border-2 p-4 transition-colors hover:border-primary/40 hover:bg-accent/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">
            {q?.question_text ?? "(question unavailable)"}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <MasteryBadge status={mistake.mastery_status} />
            <span>{mistake.wrong_count} wrong</span>
            <span>·</span>
            <span>{mistake.correct_after_wrong_count} correct after wrong</span>
            {q?.subject ? (
              <>
                <span>·</span>
                <span>{q.subject}</span>
              </>
            ) : null}
            {q?.topic ? (
              <>
                <span>·</span>
                <span>{q.topic}</span>
              </>
            ) : null}
            {mistake.last_practiced_at ? (
              <>
                <span>·</span>
                <span>Last seen {formatDate(mistake.last_practiced_at)}</span>
              </>
            ) : null}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export function MistakesEmpty({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={Target}
      title="No mistakes yet"
      description={message ?? "Take a quiz first. Wrong answers will show up here automatically."}
    />
  );
}

export function MistakesPracticeCTA() {
  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Play className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Ready to practice?</CardTitle>
            <CardDescription>
              Build a fresh quiz from your open mistakes. Your mistake bank is not changed.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/practice">Start practice session</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
