import { Database, Settings as SettingsIcon, Shield, Sparkles } from "lucide-react";

import { ApiKeyForm } from "@/app/settings/api-key-form";
import { DeleteStudentData } from "@/app/settings/delete-student-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { fetchSettings } from "@/app/actions/settings";
import { getCurrentUser } from "@/lib/auth";
import { type UserSettings } from "@/lib/types";

export default async function SettingsPage() {
  await getCurrentUser();
  const settings: UserSettings | null = await fetchSettings();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Settings"
        description="Manage your AI provider. Your key is encrypted at rest and only used to generate questions for you."
        icon={SettingsIcon}
      />

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>AI provider</CardTitle>
              <CardDescription>
                We support OpenAI, Anthropic, and Google. Pick one and paste your key. You can
                replace or remove it at any time.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ApiKeyForm current={settings} />
        </CardContent>
      </Card>

      <Card className="border-2 border-destructive/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/10 text-red-500">
              <Database className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-destructive">Student data</CardTitle>
              <CardDescription>
                Clear old uploaded materials, generated question sets, quiz attempts, and mistake
                history for this signed-in student.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DeleteStudentData />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Your API key is encrypted using Fernet encryption</p>
            <p>• Keys are only used to generate questions</p>
            <p>• We never log or share your keys</p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Supported providers
            </CardTitle>
            <CardDescription>Pick the one that matches your subscription.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">OpenAI GPT-4 / GPT-4o</Badge>
            <Badge variant="secondary">Anthropic Claude</Badge>
            <Badge variant="secondary">Google Gemini</Badge>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
