import Link from "next/link";
import { ArrowRight, BookOpen, Brain, ListChecks, Sparkles, Upload } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type DashboardSummary, type Mistake, type UserSettings } from "@/lib/types";

function isApiError(e: unknown): boolean {
  return e instanceof Error && "status" in e;
}

export default async function DashboardPage() {
  const { user } = await requireUser();

  let summary: DashboardSummary | null = null;
  let settings: UserSettings | null = null;
  let recommendations: Mistake[] | null = null;
  let apiError: string | null = null;

  try {
    [summary, settings, recommendations] = await Promise.all([
      api<DashboardSummary>("/dashboard/summary"),
      api<UserSettings>("/settings/me"),
      api<Mistake[]>("/mistakes/recommendations", { query: { limit: 5 } }),
    ]);
  } catch (err) {
    if (isApiError(err)) {
      apiError = (err as Error).message;
    } else {
      apiError = (err as Error).message;
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        </header>

        {apiError ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              <p>
                Could not reach the API: <span className="font-mono">{apiError}</span>. Make sure
                the backend is running and <code>NEXT_PUBLIC_API_BASE_URL</code> is set in your env.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!settings?.has_api_key ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Add an AI key
              </CardTitle>
              <CardDescription>
                You haven&apos;t added an API key yet. OpenAI, Anthropic, or Google — pick one on
                the settings page. Your key is encrypted at rest and never leaves your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/settings">
                  Go to Settings <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Materials"
            value={summary?.total_materials ?? 0}
            icon={BookOpen}
            href="/materials"
          />
          <Stat
            label="Question sets"
            value={summary?.total_question_sets ?? 0}
            icon={ListChecks}
            href="/materials"
          />
          <Stat
            label="Quiz attempts"
            value={summary?.total_attempts ?? 0}
            icon={Brain}
            href="/dashboard"
          />
          <Stat
            label="Open mistakes"
            value={
              summary
                ? (summary.mastery_breakdown?.new_mistake ?? 0) +
                  (summary.mastery_breakdown?.needs_practice ?? 0) +
                  (summary.mastery_breakdown?.improving ?? 0)
                : 0
            }
            icon={Brain}
            href="/mistakes"
          />
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Get started</CardTitle>
              <CardDescription>Three quick steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Step
                n={1}
                icon={Upload}
                title="Add study material"
                body="Upload a PDF/DOCX or paste text. It is saved to your private folder."
                cta="Add material"
                href="/materials/new"
              />
              <Step
                n={2}
                icon={Sparkles}
                title="Generate questions"
                body="Pick a material and generate MCQs using your AI provider."
                cta="Browse materials"
                href="/materials"
              />
              <Step
                n={3}
                icon={Brain}
                title="Practice your mistakes"
                body="Drill the questions you got wrong. Mastery updates as you improve."
                cta="View mistakes"
                href="/mistakes"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommended practice</CardTitle>
              <CardDescription>
                Top questions to revisit, ranked by mastery and recency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!recommendations || recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recommendations yet. Take a quiz first.
                </p>
              ) : (
                <ul className="space-y-3">
                  {recommendations.map((m) => (
                    <li key={m.id} className="flex items-start gap-3">
                      <Badge variant="secondary" className="shrink-0 mt-0.5">
                        {m.status.replace(/_/g, " ")}
                      </Badge>
                      <p className="text-sm line-clamp-2">{m.question.prompt}</p>
                    </li>
                  ))}
                </ul>
              )}
              {recommendations && recommendations.length > 0 ? (
                <Button asChild className="mt-4 w-full">
                  <Link href="/practice">Start practice session</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-card text-card-foreground p-4 flex items-center justify-between hover:border-foreground/30 transition-colors"
    >
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </div>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  body,
  cta,
  href,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full border flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="font-medium text-sm">
          {n}. {title}
        </p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Button asChild variant="link" size="sm" className="shrink-0">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
