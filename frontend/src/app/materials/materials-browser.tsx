"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Clock, File, FileText, Plus, Search, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type {
  DeleteMaterialResponse,
  MaterialListItem,
  MaterialFileType,
  MaterialStatus,
  MaterialUsage,
  PaginatedMaterials,
} from "@/lib/types";

interface MaterialsBrowserProps {
  materials: PaginatedMaterials;
  usage: MaterialUsage;
}

const STATUS_COLORS: Record<MaterialStatus, string> = {
  uploaded: "bg-blue-500 text-white hover:bg-blue-500/90",
  extracted: "bg-green-500 text-white hover:bg-green-500/90",
  failed: "bg-red-500 text-white hover:bg-red-500/90",
  manual: "bg-purple-500 text-white hover:bg-purple-500/90",
};

const TYPE_ICON: Record<MaterialFileType, string> = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  md: "MD",
  csv: "CSV",
  json: "JSON",
  pasted: "PASTED",
};

function typeTone(type: MaterialFileType): string {
  switch (type) {
    case "pdf":
      return "from-red-500/20 to-red-500/5";
    case "docx":
      return "from-blue-500/20 to-blue-500/5";
    case "pasted":
    case "txt":
    case "md":
      return "from-primary/20 to-primary/5";
    default:
      return "from-muted to-muted/40";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatExpiresAt(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return "Expired";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
  return `Expires in ${minutes}m`;
}

export function MaterialsBrowser({ materials, usage }: MaterialsBrowserProps) {
  const router = useRouter();
  const [items, setItems] = useState(materials.items);
  const [usageState, setUsageState] = useState(usage);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MaterialListItem | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.file_type.toLowerCase().includes(q) ||
        (m.subject?.toLowerCase().includes(q) ?? false) ||
        (m.chapter?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  const atLimit = usageState.used >= usageState.limit;

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      const result = await api<DeleteMaterialResponse>(`/materials/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      setUsageState((current) => ({
        ...current,
        used: Math.max(0, current.used - 1),
        remaining: Math.min(current.limit, current.remaining + 1),
      }));
      setDeleteTarget(null);
      toast.success("Material deleted", {
        description: `${result.deleted.learning_materials ?? 1} material removed with related study data.`,
      });
      router.refresh();
    } catch (error) {
      toast.error("Could not delete material", {
        description: (error as Error).message,
      });
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search materials..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className={cn("text-sm", atLimit ? "text-destructive" : "text-muted-foreground")}>
            {usageState.used} of {usageState.limit} materials used
            {atLimit ? ". Delete an older material before uploading a new one." : "."}
          </p>
        </div>
        {atLimit ? (
          <Button size="lg" className="gap-2" disabled>
            <Plus className="h-4 w-4" /> Limit reached
          </Button>
        ) : (
          <Button asChild size="lg" className="gap-2">
            <Link href="/materials/new">
              <Plus className="h-4 w-4" /> New material
            </Link>
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Upload}
          title={query ? "No materials match your search" : "No materials yet"}
          description={
            query
              ? "Try a different search term, or add a new material."
              : "Upload your first study material to get started. PDF, DOCX, or just paste text."
          }
          action={
            atLimit ? undefined : (
              <Button asChild size="lg" className="gap-2">
                <Link href="/materials/new">
                  <Plus className="h-4 w-4" /> Add material
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Card
              key={m.id}
              className="group h-full border-2 transition-all duration-300 hover:scale-[1.01] hover:border-primary/50 hover:shadow-lg"
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-semibold",
                      typeTone(m.file_type),
                    )}
                  >
                    {TYPE_ICON[m.file_type]}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "border-transparent px-2 py-0.5 text-[10px] uppercase tracking-wide",
                        STATUS_COLORS[m.status],
                      )}
                    >
                      {m.status}
                    </Badge>
                    {m.storage_mode === "temporary" && (
                      <Badge className="border-transparent bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                        Temporary
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(m)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${m.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <Link href={`/materials/${m.id}`} className="block space-y-3">
                  <div className="space-y-1">
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug transition-colors group-hover:text-primary">
                      {m.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-2 py-0.5 uppercase">{m.file_type}</span>
                      <span>{formatSize(m.size_bytes)}</span>
                      <span>-</span>
                      <span>{formatDate(m.created_at)}</span>
                    </div>
                    {m.storage_mode === "temporary" && m.expires_at && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        <span>{formatExpiresAt(m.expires_at)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {m.status === "failed" ? (
                        <span className="text-destructive">Extraction failed</span>
                      ) : m.page_count ? (
                        `${m.page_count} pages`
                      ) : (
                        "-"
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  {m.status === "extracted" || m.status === "manual" ? (
                    <div className="flex items-center gap-2 rounded-lg bg-accent p-2 text-xs">
                      <File className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">Ready to generate</span>
                    </div>
                  ) : null}
                  {m.status === "failed" ? (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Try re-uploading or retrying extraction.</span>
                    </div>
                  ) : null}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this material?</DialogTitle>
            <DialogDescription>
              This will remove the uploaded file, extracted text, generated question sets, quiz
              attempts, and related mistake records for {deleteTarget?.title}. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletePending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePending}>
              {deletePending ? "Deleting..." : "Delete material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
