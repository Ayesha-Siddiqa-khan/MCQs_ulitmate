"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Type } from "lucide-react";

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
import { type Material } from "@/lib/types";

const fileSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  file: z
    .custom<File>((v) => v instanceof File, "Pick a file")
    .refine((f) => f.size <= 20 * 1024 * 1024, "Max 20 MB")
    .refine(
      (f) =>
        [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(f.type),
      "Only PDF or DOCX",
    ),
});

const pasteSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(20, "Paste at least 20 characters of text"),
  subject: z.string().max(100).optional().or(z.literal("")),
  chapter: z.string().max(100).optional().or(z.literal("")),
  topic: z.string().max(100).optional().or(z.literal("")),
});

type FileValues = z.infer<typeof fileSchema>;
type PasteValues = z.infer<typeof pasteSchema>;

export function MaterialNewForm() {
  const router = useRouter();
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileForm = useForm<FileValues>({
    resolver: zodResolver(fileSchema),
    defaultValues: { title: "" } as FileValues,
  });
  const pasteForm = useForm<PasteValues>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { title: "", content: "", subject: "", chapter: "", topic: "" },
  });

  function onFileSubmit(values: FileValues) {
    setError(null);
    const fd = new FormData();
    fd.set("title", values.title);
    fd.set("file", values.file);
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
    setError(null);
    const { title, content, subject, chapter, topic } = values;
    startTransition(async () => {
      try {
        const m = await api<Material>("/materials/paste-text", {
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

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "file" | "paste")}>
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
                      accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => field.onChange(e.target.files?.[0])}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>PDF or DOCX, up to 20 MB.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading..." : "Upload"}
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
              {pending ? "Saving..." : "Save"}
            </Button>
          </form>
        </Form>
      </TabsContent>
    </Tabs>
  );
}
