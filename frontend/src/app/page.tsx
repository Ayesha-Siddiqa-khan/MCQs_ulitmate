import Link from "next/link";
import { BookOpen, Brain, ListChecks } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

const features = [
  {
    icon: BookOpen,
    title: "Upload study material",
    body: "Paste text or upload PDF/DOCX. Text is extracted and stored privately in your own folder.",
  },
  {
    icon: Brain,
    title: "Bring your own AI key",
    body: "Use OpenAI, Anthropic, or Google. Your key is encrypted at rest — we never see it after you save it.",
  },
  {
    icon: ListChecks,
    title: "Practice only your mistakes",
    body: "Wrong answers go to your mistake bank. A mastery tracker decides when a question is retired.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  return (
    <main className="container mx-auto px-4 py-16">
        <section className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Turn study material into practice questions
          </h1>
          <p className="text-lg text-muted-foreground">
            MCQ Mentor reads your notes, generates multiple-choice questions with your AI key, and
            helps you drill the ones you keep getting wrong.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mt-16 max-w-5xl mx-auto">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-lg border bg-card text-card-foreground p-6 space-y-2"
            >
              <Icon className="h-6 w-6" />
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
  );
}
