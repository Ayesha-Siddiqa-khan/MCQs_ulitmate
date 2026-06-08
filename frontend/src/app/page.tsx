import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  FileQuestion,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Upload,
    title: "Upload solved MCQ files",
    body: "Use PDFs, DOCX files, pasted notes, or already solved question sheets.",
    tone: "from-blue-500/20 to-cyan-500/5 text-blue-500",
  },
  {
    icon: FileQuestion,
    title: "Choose a focused quiz",
    body: "Practice all questions, a quick 10, a longer set, or a custom amount.",
    tone: "from-purple-500/20 to-fuchsia-500/5 text-purple-500",
  },
  {
    icon: Brain,
    title: "Review and retry mistakes",
    body: "Wrong answers are saved so students can rebuild practice from weak areas.",
    tone: "from-emerald-500/20 to-lime-500/5 text-emerald-500",
  },
];

const steps = [
  {
    icon: BookOpen,
    title: "Add material",
    body: "Upload a document or paste text, then extract the study content.",
  },
  {
    icon: Layers3,
    title: "Build a question set",
    body: "Extract solved MCQs or generate new ones using your saved AI key.",
  },
  {
    icon: Target,
    title: "Practice with intent",
    body: "Pick a question count, submit when ready, and review every missed answer.",
  },
];

const stats = [
  { label: "Quiz modes", value: "3" },
  { label: "Setup choices", value: "5" },
  { label: "Mistake tracking", value: "On" },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="overflow-hidden">
      <section className="border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-18 lg:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
            Student practice SaaS for MCQs
          </div>
          <div className="mx-auto mt-6 max-w-3xl space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Turn study material into focused MCQ practice
            </h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">
              MCQ Mentor extracts questions from your material, lets you choose exactly how much to
              practice, and keeps wrong answers ready for targeted revision.
            </p>
          </div>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/signup">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-3 rounded-lg border bg-card/70 p-3 text-left shadow-xl shadow-black/5 backdrop-blur sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border bg-background/70 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        {features.map(({ icon: Icon, title, body, tone }) => (
          <Card
            key={title}
            className="border-2 bg-gradient-to-br from-card to-muted/20 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <CardContent className="space-y-4 p-6">
              <div
                className={`inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${tone}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="border-y bg-muted/25">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-medium text-primary">How it works</p>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                A clean path from material to mastery
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                The workflow stays short for quick study sessions, but still records enough detail
                for meaningful review.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Private account data
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <Card
                key={step.title}
                className="border-2 bg-card/80 transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-lg border bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Ready for the first material
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Create an account and start practicing.</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Add a material, extract MCQs, choose a quiz size, and let the app build your mistake
              bank as you study.
            </p>
          </div>
          <Button asChild size="lg" className="gap-2 md:justify-self-end">
            <Link href="/signup">
              Create account <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
