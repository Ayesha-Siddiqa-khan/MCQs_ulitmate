"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, File, FileText, Plus, Search, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import type { Material, MaterialFileType, MaterialStatus } from "@/lib/types";

interface MaterialsBrowserProps {
  materials: Material[];
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
      return "from-purple-500/20 to-purple-500/5";
    default:
      return "from-muted to-muted/40";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MaterialsBrowser({ materials }: MaterialsBrowserProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return materials;
    const q = query.toLowerCase();
    return materials.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.file_type.toLowerCase().includes(q) ||
        (m.subject?.toLowerCase().includes(q) ?? false) ||
        (m.chapter?.toLowerCase().includes(q) ?? false),
    );
  }, [materials, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link href="/materials/new">
            <Plus className="h-4 w-4" /> New material
          </Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Upload}
          title={query ? "No materials match your search" : "No materials yet"}
          description={
            query
              ? `Try a different search term, or add a new material.`
              : "Upload your first study material to get started. PDF, DOCX, or just paste text."
          }
          action={
            <Button asChild size="lg" className="gap-2">
              <Link href="/materials/new">
                <Plus className="h-4 w-4" /> Add material
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Link key={m.id} href={`/materials/${m.id}`} className="group block">
              <Card
                className={cn(
                  "h-full border-2 transition-all duration-300 group-hover:scale-[1.01] group-hover:border-primary/50 group-hover:shadow-lg",
                )}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-semibold",
                        typeTone(m.file_type),
                      )}
                    >
                      {TYPE_ICON[m.file_type]}
                    </div>
                    <Badge
                      className={cn(
                        "border-transparent px-2 py-0.5 text-[10px] uppercase tracking-wide",
                        STATUS_COLORS[m.status],
                      )}
                    >
                      {m.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {m.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-2 py-0.5 uppercase">
                        {m.file_type}
                      </span>
                      <span>{formatSize(m.size_bytes)}</span>
                      <span>·</span>
                      <span>{formatDate(m.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {m.status === "failed" ? (
                        <span className="text-destructive">Extraction failed</span>
                      ) : m.page_count ? (
                        `${m.page_count} pages`
                      ) : (
                        "—"
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
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
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
