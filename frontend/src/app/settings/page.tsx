import { ApiKeyForm } from "@/app/settings/api-key-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSettings } from "@/app/actions/settings";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  await requireUser();
  const settings = await fetchSettings();

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your AI provider. Your key is encrypted at rest and only used to generate
            questions for you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>AI provider</CardTitle>
            <CardDescription>
              We support OpenAI, Anthropic, and Google. Pick one and paste your key. You can
              replace or remove it at any time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeyForm current={settings} />
          </CardContent>
        </Card>
      </main>
  );
}
