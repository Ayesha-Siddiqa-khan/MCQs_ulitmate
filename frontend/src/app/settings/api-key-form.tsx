"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Trash2 } from "lucide-react";

import {
  deleteApiKeyAction,
  saveApiKeyAction,
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type AIProvider, type UserSettings } from "@/lib/types";

const schema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  api_key: z.string().min(10, "Looks too short to be a real key"),
});

type Values = z.infer<typeof schema>;

export function ApiKeyForm({ current }: { current: UserSettings | null }) {
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: (current?.preferred_provider as AIProvider) ?? "openai",
      api_key: "",
    },
  });

  function onSubmit(values: Values) {
    setError(null);
    setOk(false);
    const fd = new FormData();
    fd.set("provider", values.provider);
    fd.set("api_key", values.api_key);
    startTransition(async () => {
      const r = await saveApiKeyAction(fd);
      if (r?.error) setError(r.error);
      else {
        setOk(true);
        form.reset({ provider: values.provider, api_key: "" });
      }
    });
  }

  function onDelete() {
    setError(null);
    setOk(false);
    startDeleting(async () => {
      const r = await deleteApiKeyAction();
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {current?.has_api_key ? (
        <Alert>
          <AlertTitle>Key on file</AlertTitle>
          <AlertDescription>
            Provider: {current.preferred_provider ?? "unspecified"}. Encrypted at rest.{" "}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-1 h-auto"
              onClick={onDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>No key saved</AlertTitle>
          <AlertDescription>
            You can still read your materials and review past attempts, but you won&apos;t be
            able to generate new questions until you add a key.
          </AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {ok ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your key was encrypted and stored.</AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="api_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API key</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder="sk-... / sk-ant-... / AIza..."
                      autoComplete="off"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowKey((s) => !s)}
                      aria-label={showKey ? "Hide key" : "Show key"}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>Stored encrypted with Fernet. Never logged.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : current?.has_api_key ? "Replace key" : "Save key"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
