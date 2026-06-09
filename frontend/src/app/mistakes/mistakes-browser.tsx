"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ChevronRight,
  Filter,
  ListChecks,
  Play,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { DeleteMistakesResponse, MasteryStatus, MistakeListItem, PaginatedMistakes } from "@/lib/types";

const STATUS_ORDER: MasteryStatus[] = [
  "new_mistake",
  "needs_practice",
  "improving",
  "mastered",
];

interface MistakesBrowserProps {
  mistakes: PaginatedMistakes;
}

type ClearTarget =
  | { type: "one"; mistake: MistakeListItem }
  | { type: "status"; status: MasteryStatus; count: number }
  | { type: "all"; count: number };

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MistakesBrowser({ mistakes }: MistakesBrowserProps) {
  const router = useRouter();
  const [items, setItems] = useState(mistakes.items);
  const [active, setActive] = useState<MasteryStatus | "all">("all");
  const [clearTarget, setClearTarget] = useState<ClearTarget | null>(null);
  const [pending, setPending] = useState(false);

  const counts = useMemo(() => {
    return {
      new_mistake: mistakes.counts.new_mistake || 0,
      needs_practice: mistakes.counts.needs_practice || 0,
      improving: mistakes.counts.improving || 0,
      mastered: mistakes.counts.mastered || 0,
    };
  }, [mistakes.counts]);

  const filtered = useMemo(() => {
    if (active === "all") return items;
    return items.filter((m) => m.mastery_status === active);
  }, [items, active]);

  const grouped = useMemo(() => {
    const map: Record<MasteryStatus, MistakeListItem[]> = {
      new_mistake: [],
      needs_practice: [],
      improving: [],
      mastered: [],
    };
    for (const m of filtered) map[m.mastery_status].push(m);
    return map;
  }, [filtered]);

  async function confirmClear() {
    if (!clearTarget) return;
    setPending(true);
    try {
      let result: DeleteMistakesResponse;
      if (clearTarget.type === "one") {
        result = await api<DeleteMistakesResponse>(`/mistakes/${clearTarget.mistake.id}`, {
          method: "DELETE",
        });
        setItems((current) => current.filter((m) => m.id !== clearTarget.mistake.id));
      } else if (clearTarget.type === "status") {
        result = await api<DeleteMistakesResponse>("/mistakes", {
          method: "DELETE",
          query: { status: clearTarget.status },
        });
        setItems((current) => current.filter((m) => m.mastery_status !== clearTarget.status));
      } else {
        result = await api<DeleteMistakesResponse>("/mistakes/all", { method: "DELETE" });
        setItems([]);
      }

      toast.success("Mistakes cleared", {
        description: `${result.deleted} mistake record${result.deleted === 1 ? "" : "s"} removed.`,
      });
      setClearTarget(null);
      router.refresh();
    } catch (error) {
      toast.error("Could not clear mistakes", {
        description: (error as Error).message,
      });
    } finally {
      setPending(false);
    }
  }

  const clearTitle =
    clearTarget?.type === "one"
      ? "Delete this mistake?"
      : clearTarget?.type === "status"
        ? `Clear ${MASTERY_LABEL[clearTarget.status].toLowerCase()} mistakes?`
        : "Clear all mistakes?";
  const clearCount =
    clearTarget?.type === "one"
      ? 1
      : clearTarget?.type === "status"
        ? clearTarget.count
        : clearTarget?.count ?? 0;

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
                "group rounded-lg border-2 bg-gradient-to-br p-4 text-left transition-all hover:scale-[1.02]",
                masteryTone(status),
                isActive ? "shadow-md ring-2 ring-foreground/40" : "",
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
                <p className="text-xs text-muted-foreground">{MASTERY_DESCRIPTION[status]}</p>
              </div>
            </motion.button>
          );
        })}
      </motion.section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filter
          </span>
          <Pill active={active === "all"} onClick={() => setActive("all")}>
            All ({items.length})
          </Pill>
          {STATUS_ORDER.map((status) => (
            <Pill
              key={status}
              active={active === status}
              onClick={() => setActive(active === status ? "all" : status)}
            >
              {MASTERY_LABEL[status]} ({counts[status]})
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {active !== "all" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setActive("all")}>
                <RotateCcw className="h-3.5 w-3.5" /> Clear filter
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={counts[active] === 0}
                onClick={() => setClearTarget({ type: "status", status: active, count: counts[active] })}
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear this status
              </Button>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={items.length === 0}
            onClick={() => setClearTarget({ type: "all", count: items.length })}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all mistakes
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
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
                      <MistakeRow
                        mistake={m}
                        onDelete={() => setClearTarget({ type: "one", mistake: m })}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={!!clearTarget} onOpenChange={(open) => !open && setClearTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{clearTitle}</DialogTitle>
            <DialogDescription>
              This will remove {clearCount} selected mistake practice record
              {clearCount === 1 ? "" : "s"}, but your original material and question sets will
              remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearTarget(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClear} disabled={pending}>
              {pending ? "Clearing..." : "Clear mistakes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-muted text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function MistakeRow({ mistake, onDelete }: { mistake: MistakeListItem; onDelete: () => void }) {
  return (
    <div className="rounded-lg border-2 p-4 transition-colors hover:border-primary/40 hover:bg-accent/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">{mistake.question_text ?? "(question unavailable)"}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <MasteryBadge status={mistake.mastery_status} />
            <span>{mistake.wrong_count} wrong</span>
            <span>-</span>
            <span>{mistake.correct_after_wrong_count} correct after wrong</span>
            {mistake.subject ? (
              <>
                <span>-</span>
                <span>{mistake.subject}</span>
              </>
            ) : null}
            {mistake.topic ? (
              <>
                <span>-</span>
                <span>{mistake.topic}</span>
              </>
            ) : null}
            {mistake.last_practiced_at ? (
              <>
                <span>-</span>
                <span>Last seen {formatDate(mistake.last_practiced_at)}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete mistake"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
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
              Build a fresh quiz from your open mistakes. Mastery updates after you submit.
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
