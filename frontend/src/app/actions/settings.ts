"use server";

import { revalidatePath } from "next/cache";

import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import {
  type AIProvider,
  type UpdateSettingsRequest,
  type UserSettings,
} from "@/lib/types";

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
    const payload: UpdateSettingsRequest = {
      ai_provider: provider,
      ai_api_key: apiKey,
    };
    await api("/settings", { method: "PUT", json: payload });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteApiKeyAction(): Promise<SettingsResult> {
  await requireUser();
  try {
    const payload: UpdateSettingsRequest = { clear_api_key: true };
    await api("/settings", { method: "PUT", json: payload });
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function fetchSettings(): Promise<UserSettings | null> {
  try {
    return await api<UserSettings>("/settings");
  } catch {
    return null;
  }
}
