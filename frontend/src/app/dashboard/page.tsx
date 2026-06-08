import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  FileText,
  Info,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type RecentAttempt, type RecentMaterial } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function scoreColor(percentage: number): string {
  if (percentage >= 70) return "text-green-500";
  if (percentage >= 40) return "text-yellow-500";
  return "text-red-500";
}

export default async function DashboardPage() {
  const user = await requireUser();

  let recentUploads: RecentMaterial[] = [];
  let recentAttempts: RecentAttempt[] = [];
  let apiError: string | null = null;

  type Summary = {
    total_quizzes: number;
    average_score: number;
    total_wrong_questions: number;
    mastered_mistakes: number;
    weak_topics: string[];
    recent_uploads: RecentMaterial[];
    recent_attempts: RecentAttempt[];
    continue_practice_attempt_id: string | null;
  };

  let summary: Summary | null = null;
  try {
    summary = await api<Summary>("/dashboard/summary");
  } catch (e) {
    apiError = (e as Error).message;
  }

  const settings = await api<{ has_api_key: boolean }>("/settings").catch(() => null);

  const recommendations = await api<{ label: string; count: number; reason: string }[]>(
    "/mistakes/recommendations",
  ).catch(() => [] as { label: string; count: number; reason: string }[]);

  if (summary) {
    recentUploads = summary.recent_uploads ?? [];
    recentAttempts = summary.recent_attempts ?? [];
  }

  const stats = summary
    ? [
        {
          label: "Quizzes taken",
          value: summary.total_quizzes ?? 0,
          icon: BookOpen,
          color: "text-blue-500",
          href: "/dashboard",
        },
        {
          label: "Average score",
          value: `${Math.round(summary.average_score ?? 0)}%`,
          icon: TrendingUp,
          color: "text-green-500",
          href: "/dashboard",
        },
        {
          label: "Open mistakes",
          value: summary.total_wrong_questions ?? 0,
          icon: AlertTriangle,
          color: "text-orange-500",
          href: "/mistakes",
        },
        {
          label: "Mastered",
          value: summary.mastered_mistakes ?? 0,
          icon: Award,
          color: "text-purple-500",
          href: "/mistakes",
        },
      ]
    : [];

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.email ?? "learner"}. Pick up where you left off.`}
      />

      {apiError ? (
        <Card className="border-2 border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            <p>
              Could not reach the API: <span className="font-mono">{apiError}</span>.{" "}
              {process.env.VERCEL === "1" ? (
                <>
                  Check that <code>NEXT_PUBLIC_API_BASE_URL</code> is set to{" "}
                  <code>/api</code> in Vercel Dashboard → Settings → Environment Variables.
                </>
              ) : (
                <>
                  Make sure the backend is running and <code>NEXT_PUBLIC_API_BASE_URL</code> is
                  set in <code>frontend/.env.local</code>.
                </>
              )}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!settings?.has_api_key ? (
        <Card className="border-l-4 border-l-blue-500 border-2 bg-gradient-to-r from-blue-500/10 to-transparent">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <CardTitle>Add an AI key</CardTitle>
                <CardDescription>
                  You haven&apos;t added an API key yet. OpenAI, Anthropic, or Google — pick one on
                  the settings page. Your key is encrypted at rest and never leaves your account.
                </CardDescription>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/settings">
                    Go to Settings <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {summary?.continue_practice_attempt_id ? (
        <Card className="border-2 border-primary/40 bg-gradient-to-r from-primary/10 to-purple-500/5">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Brain className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <CardTitle>Continue your last quiz</CardTitle>
                <CardDescription>
                  You have an unfinished attempt. Pick up where you left off.
                </CardDescription>
                <Button asChild size="sm" className="mt-3">
                  <Link href={`/quiz/${summary.continue_practice_attempt_id}`}>
                    Resume <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            href={stat.href}
            iconClassName={stat.color}
          />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Get started
            </CardTitle>
            <CardDescription>Three quick steps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Step
              n={1}
              icon={Upload}
              color="bg-blue-500"
              title="Add study material"
              body="Upload a PDF/DOCX or paste text. It is saved to your private folder."
              cta="Add material"
              href="/materials/new"
            />
            <Step
              n={2}
              icon={Sparkles}
              color="bg-purple-500"
              title="Generate questions"
              body="Pick a material and generate MCQs using your AI provider."
              cta="Browse materials"
              href="/materials"
            />
            <Step
              n={3}
              icon={Brain}
              color="bg-green-500"
              title="Practice your mistakes"
              body="Drill the questions you got wrong. Mastery updates as you improve."
              cta="View mistakes"
              href="/mistakes"
            />
          </CardContent>
        </Card>

        <Card className="h-full border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Recommended practice
            </CardTitle>
            <CardDescription>Suggested practice sessions based on your open mistakes.</CardDescription>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No recommendations yet. Take a quiz first.
                </p>
              </div>
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
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-orange-500" />
              Weak topics
            </CardTitle>
            <CardDescription>Topics you keep getting wrong.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.weak_topics.map((t) => (
                <Badge key={t} variant="outline" className="px-3 py-1">
                  {t}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-500" />
              Recent uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentUploads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No materials yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentUploads.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/materials/${m.id}`}
                      className="group flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                            {m.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.file_type.toUpperCase()} · {formatDate(m.created_at)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-500" />
              Recent attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAttempts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No attempts yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentAttempts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/results/${a.id}`}
                      className="group flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                          {a.title ?? "Untitled set"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.score}/{a.total_questions} · {Math.round(a.percentage)}% · {formatDate(a.submitted_at)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          scoreColor(a.percentage),
                        )}
                      >
                        {Math.round(a.percentage)}%
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {recentUploads.length === 0 && recentAttempts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Start with your first material"
          description="Add a PDF or paste some notes — we'll extract the text and generate questions for you."
          action={
            <Button asChild>
              <Link href="/materials/new">
                <Upload className="mr-2 h-4 w-4" /> Add material
              </Link>
            </Button>
          }
        />
      ) : null}
    </main>
  );
}

function Step({
  n,
  icon: Icon,
  color,
  title,
  body,
  cta,
  href,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-accent group">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white",
          color,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium group-hover:text-primary transition-colors">
            {n}. {title}
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link href={href}>{cta}</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
