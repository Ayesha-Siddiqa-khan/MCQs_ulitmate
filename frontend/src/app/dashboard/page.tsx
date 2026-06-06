import Link from "next/link";
import { ArrowRight, BookOpen, Brain, ListChecks, Sparkles, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import {
  type DashboardSummary,
  type MistakeRecommendation,
  type UserSettings,
} from "@/lib/types";

export default async function DashboardPage() {
  const user = await requireUser();

  let summary: DashboardSummary | null = null;
  let settings: UserSettings | null = null;
  let recommendations: MistakeRecommendation[] = [];
  let apiError: string | null = null;

  try {
    [summary, settings, recommendations] = await Promise.all([
      api<DashboardSummary>("/dashboard/summary"),
      api<UserSettings>("/settings"),
      api<MistakeRecommendation[]>("/mistakes/recommendations"),
    ]);
  } catch (err) {
    apiError = (err as Error).message;
  }

  const openMistakes = summary?.total_wrong_questions ?? 0;
  const mastered = summary?.mastered_mistakes ?? 0;

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

        {summary?.continue_practice_attempt_id ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" /> Continue your last quiz
              </CardTitle>
              <CardDescription>
                You have an unfinished attempt. Pick up where you left off.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/quiz/${summary.continue_practice_attempt_id}`}>
                  Resume <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Quizzes taken"
            value={summary?.total_quizzes ?? 0}
            icon={Brain}
            href="/dashboard"
          />
          <Stat
            label="Average score"
            value={`${Math.round(summary?.average_score ?? 0)}%`}
            icon={ListChecks}
            href="/dashboard"
          />
          <Stat label="Open mistakes" value={openMistakes} icon={Brain} href="/mistakes" />
          <Stat label="Mastered" value={mastered} icon={BookOpen} href="/mistakes" />
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
                Suggested practice sessions based on your open mistakes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recommendations yet. Take a quiz first.
                </p>
              ) : (
                <ul className="space-y-3">
                  {recommendations.slice(0, 5).map((r) => (
                    <li key={r.label} className="flex items-start gap-3">
                      <Badge variant="secondary" className="shrink-0 mt-0.5">
                        {r.count}
                      </Badge>
                      <div className="text-sm">
                        <p className="font-medium">{r.label}</p>
                        <p className="text-muted-foreground">{r.reason}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {recommendations.length > 0 ? (
                <Button asChild className="mt-4 w-full">
                  <Link href="/practice">Start practice session</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {summary && summary.weak_topics.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Weak topics</CardTitle>
              <CardDescription>Topics you keep getting wrong.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {summary.weak_topics.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent uploads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary?.recent_uploads?.length ? (
                summary.recent_uploads.map((m) => (
                  <Link
                    key={m.id}
                    href={`/materials/${m.id}`}
                    className="flex items-center justify-between rounded border p-3 hover:border-foreground/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground uppercase">{m.file_type}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No materials yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent attempts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary?.recent_attempts?.length ? (
                summary.recent_attempts.map((a) => (
                  <Link
                    key={a.id}
                    href={`/results/${a.id}`}
                    className="flex items-center justify-between rounded border p-3 hover:border-foreground/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.title ?? "Untitled set"}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.score}/{a.total_questions} · {Math.round(a.percentage)}%
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No attempts yet.</p>
              )}
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
  value: number | string;
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
