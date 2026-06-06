"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type AIProvider, type UserSettings } from "@/lib/types";

export type SettingsResult = { error?: string; ok?: boolean } | undefined;

export async function saveApiKeyAction(formData: FormData): Promise<SettingsResult> {
  await requireUser();
  const provider = String(formData.get("provider") ?? "") as AIProvider;
  const apiKey = String(formData.get("api_key") ?? "").trim();
  if (!["openai", "anthropic", "google"].includes(provider)) {
    return { error: "Pick a provider." };
  }
  if (!apiKey) {
    return { error: "API key is required." };
  }
  try {
    await api("/settings/me/api-key", {
      method: "PUT",
      json: { provider, api_key: apiKey },
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteApiKeyAction(): Promise<SettingsResult> {
  await requireUser();
  try {
    await api("/settings/me/api-key", { method: "DELETE" });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function fetchSettings(): Promise<UserSettings | null> {
  try {
    return await api<UserSettings>("/settings/me");
  } catch {
    return null;
  }
}
