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
    title: z.string().max(200).optional().or(z.literal("")),
    file: z
      .custom<File>((v) => v instanceof File, "Pick a file")
      .refine((f) => f.size <= maxMb * 1024 * 1024, `Max ${maxMb} MB`),
  });
}

const pasteSchema = z.object({
  title: z.string().max(200).optional().or(z.literal("")),
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
  const [storageMode, setStorageMode] = useState<"saved" | "temporary">("temporary");
  const [limits, setLimits] = useState<UploadLimits | null>(null);

  useEffect(() => {
    api<UploadLimits>("/config/upload-limits").then(setLimits).catch(() => {
      setLimits({ max_upload_mb: 50, max_materials_per_user: 2, allowed_extensions: ["pdf","docx","txt","md","csv","json"] });
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
      setError(`You have reached the ${usage.limit}-material limit. Practice without saving or delete an old material.`);
      return;
    }
    setError(null);
    const fd = new FormData();
    const titleValue = values.title?.trim() || values.file?.name?.replace(/\.[^.]+$/, "") || "";
    fd.set("title", titleValue);
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
      setError(`You have reached the ${usage.limit}-material limit. Practice without saving or delete an old material.`);
      return;
    }
    setError(null);
    const { content, subject, chapter, topic } = values;
    const titleValue = values.title?.trim() || "";
    startTransition(async () => {
      try {
        const m = await api<Material>(`/materials/paste-text?storage_mode=${storageMode}`, {
          json: {
            title: titleValue,
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
          Upload a file or paste text to start quick practice. You can save up to 2 materials in your library.
        </p>
        <p className="text-xs text-muted-foreground">
          {usage.used} of {usage.limit} saved materials used.
        </p>
        {atLimit && storageMode === "saved" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You have reached the saved material limit. Switch to &quot;Practice without saving&quot; or delete an old saved material.
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
            <RadioGroupItem value="temporary" id="mode-temp" />
            <Label htmlFor="mode-temp" className="cursor-pointer font-normal flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Practice without saving
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="saved" id="mode-saved" />
            <Label htmlFor="mode-saved" className="cursor-pointer font-normal flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save to library
            </Label>
          </div>
        </RadioGroup>
        <p className="mt-1 text-xs text-muted-foreground">
          {storageMode === "temporary"
            ? "Use this for quick practice. Your file will not count toward your saved material limit unless you choose to save it later."
            : "Save this material permanently. It counts toward your 2-material limit."}
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
                  <FormLabel>Title (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional — we'll use the file name if left blank" {...field} />
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
                  <FormLabel>Title (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional — we'll use a default title if left blank" {...field} />
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
