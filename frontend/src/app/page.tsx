import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Brain, Sparkles } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Sparkles as SparklesIcon } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Upload study material",
    body: "Paste text or upload PDF/DOCX. Text is extracted and stored privately in your own folder.",
    color: "text-blue-500",
    bg: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: Sparkles,
    title: "Bring your own AI key",
    body: "Use OpenAI, Anthropic, or Google. Your key is encrypted at rest — we never see it after you save it.",
    color: "text-purple-500",
    bg: "from-purple-500/20 to-purple-500/5",
  },
  {
    icon: Brain,
    title: "Practice only your mistakes",
    body: "Wrong answers go to your mistake bank. A mastery tracker decides when a question is retired.",
    color: "text-green-500",
    bg: "from-green-500/20 to-green-500/5",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl text-center space-y-6">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground shadow-lg">
          <SparklesIcon className="h-7 w-7" />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Turn study material into practice questions
        </h1>
        <p className="text-lg text-muted-foreground">
          MCQ Mentor reads your notes, generates multiple-choice questions with your AI key,
          and helps you drill the ones you keep getting wrong.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, title, body, color, bg }) => (
          <Card
            key={title}
            className={`border-2 bg-gradient-to-br ${bg} hover:shadow-lg transition-shadow`}
          >
            <CardContent className="p-6 space-y-3">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-background/60 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-16">
        <PageHeader
          title="How it works"
          description="Three short steps. No account required to look around."
        />
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { n: 1, title: "Add a material", body: "Upload a PDF/DOCX or paste text. Stored privately." },
            { n: 2, title: "Generate MCQs", body: "Pick a material and your AI provider. The set is ready in seconds." },
            { n: 3, title: "Drill mistakes", body: "Wrong answers go to your mistake bank. Mastery updates as you improve." },
          ].map((step) => (
            <li
              key={step.n}
              className="rounded-xl border-2 bg-card p-5 space-y-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {step.n}
              </div>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <EmptyState
          icon={Brain}
          title="Ready when you are"
          description="Create an account to upload your first material and generate questions in under a minute."
          action={
            <Button asChild size="lg">
              <Link href="/signup">Create an account</Link>
            </Button>
          }
        />
      </section>
    </main>
  );
}
