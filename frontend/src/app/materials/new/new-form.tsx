"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Type, Save, Zap } from "lucide-react";

import { api, apiUpload } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { type Material, type MaterialUsage, type UploadLimits } from "@/lib/types";

const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
].join(",");

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt,.md,.csv,.json";

function buildFileSchema(maxMb: number) {
  return z.object({
    title: z.string().min(1, "Title is required").max(200),
    file: z
      .custom<File>((v) => v instanceof File, "Pick a file")
      .refine((f) => f.size <= maxMb * 1024 * 1024, `Max ${maxMb} MB`),
  });
}

const pasteSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(20, "Paste at least 20 characters of text"),
  subject: z.string().max(100).optional().or(z.literal("")),
  chapter: z.string().max(100).optional().or(z.literal("")),
  topic: z.string().max(100).optional().or(z.literal("")),
});

type PasteValues = z.infer<typeof pasteSchema>;

export function MaterialNewForm({ usage }: { usage: MaterialUsage }) {
  const router = useRouter();
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [storageMode, setStorageMode] = useState<"saved" | "temporary">("saved");
  const [limits, setLimits] = useState<UploadLimits | null>(null);

  useEffect(() => {
    api<UploadLimits>("/config/upload-limits").then(setLimits).catch(() => {
      setLimits({ max_upload_mb: 50, max_materials_per_user: 5, allowed_extensions: ["pdf","docx","txt","md","csv","json"] });
    });
  }, []);

  const maxMb = limits?.max_upload_mb ?? 50;
  const fileSchema = buildFileSchema(maxMb);

  type FileValues = z.infer<typeof fileSchema>;

  const fileForm = useForm<FileValues>({
    resolver: zodResolver(fileSchema),
    defaultValues: { title: "" } as FileValues,
  });
  const pasteForm = useForm<PasteValues>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { title: "", content: "", subject: "", chapter: "", topic: "" },
  });

  function onFileSubmit(values: FileValues) {
    if (storageMode === "saved" && usage.used >= usage.limit) {
      setError("You have reached the 5-material limit. Practice without saving or delete an old material.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("title", values.title);
    fd.set("file", values.file);
    fd.set("storage_mode", storageMode);
    startTransition(async () => {
      try {
        const m = await apiUpload<Material>("/materials/upload", fd);
        router.push(`/materials/${m.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function onPasteSubmit(values: PasteValues) {
    if (storageMode === "saved" && usage.used >= usage.limit) {
      setError("You have reached the 5-material limit. Practice without saving or delete an old material.");
      return;
    }
    setError(null);
    const { title, content, subject, chapter, topic } = values;
    startTransition(async () => {
      try {
        const m = await api<Material>(`/materials/paste-text?storage_mode=${storageMode}`, {
          json: {
            title,
            text: content,
            subject: subject || undefined,
            chapter: chapter || undefined,
            topic: topic || undefined,
          },
        });
        router.push(`/materials/${m.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const atLimit = usage.used >= usage.limit;

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "file" | "paste")}>
      <div className="mb-3 space-y-2">
        <p className="text-sm text-muted-foreground">
          {usage.used} of {usage.limit} saved materials used. {usage.remaining} slot
          {usage.remaining === 1 ? "" : "s"} available.
        </p>
        {atLimit && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You can still practice without saving, or delete an old saved material.
          </p>
        )}
      </div>

      <div className="mb-4">
        <Label className="text-sm font-medium">Storage mode</Label>
        <RadioGroup
          value={storageMode}
          onValueChange={(v) => setStorageMode(v as "saved" | "temporary")}
          className="mt-2 flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="saved" id="mode-saved" />
            <Label htmlFor="mode-saved" className="cursor-pointer font-normal flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save to library
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="temporary" id="mode-temp" />
            <Label htmlFor="mode-temp" className="cursor-pointer font-normal flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Practice without saving
            </Label>
          </div>
        </RadioGroup>
        <p className="mt-1 text-xs text-muted-foreground">
          {storageMode === "saved"
            ? "Material is saved to your library and counts toward your limit."
            : "Material is processed temporarily. You can save or discard after practice."}
        </p>
      </div>

      <TabsList>
        <TabsTrigger value="file">
          <FileText className="h-4 w-4 mr-2" /> Upload file
        </TabsTrigger>
        <TabsTrigger value="paste">
          <Type className="h-4 w-4 mr-2" /> Paste text
        </TabsTrigger>
      </TabsList>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <TabsContent value="file" className="mt-4">
        <Form {...fileForm}>
          <form onSubmit={fileForm.handleSubmit(onFileSubmit)} className="space-y-4">
            <FormField
              control={fileForm.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Biology chapter 5 notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={fileForm.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept={ACCEPTED_EXTENSIONS}
                      onChange={(e) => field.onChange(e.target.files?.[0])}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    PDF, DOCX, TXT, MD, CSV, or JSON. Up to {maxMb} MB.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading..." : storageMode === "temporary" ? "Upload & practice" : "Upload"}
            </Button>
          </form>
        </Form>
      </TabsContent>

      <TabsContent value="paste" className="mt-4">
        <Form {...pasteForm}>
          <form onSubmit={pasteForm.handleSubmit(onPasteSubmit)} className="space-y-4">
            <FormField
              control={pasteForm.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Calculus formulas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid sm:grid-cols-3 gap-3">
              <FormField
                control={pasteForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Math" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pasteForm.control}
                name="chapter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chapter</FormLabel>
                    <FormControl>
                      <Input placeholder="Ch. 5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pasteForm.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <FormControl>
                      <Input placeholder="Derivatives" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={pasteForm.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea rows={12} placeholder="Paste your notes here..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : storageMode === "temporary" ? "Save & practice" : "Save"}
            </Button>
          </form>
        </Form>
      </TabsContent>
    </Tabs>
  );
}
