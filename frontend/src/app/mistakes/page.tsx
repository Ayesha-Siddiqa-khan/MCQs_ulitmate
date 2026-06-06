import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-server";
import { requireUser } from "@/lib/auth";
import { type MasteryStatus, type Mistake } from "@/lib/types";

const statusVariant: Record<MasteryStatus, "default" | "secondary" | "destructive" | "outline"> = {
  new_mistake: "destructive",
  needs_practice: "destructive",
  improving: "secondary",
  mastered: "outline",
};

export default async function MistakesPage() {
  await requireUser();
  let mistakes: Mistake[] = [];
  let error: string | null = null;
  try {
    mistakes = await api<Mistake[]>("/mistakes");
  } catch (e) {
    error = (e as Error).message;
  }

  const counts = mistakes.reduce<Record<MasteryStatus, number>>(
    (acc, m) => {
      acc[m.mastery_status] = (acc[m.mastery_status] ?? 0) + 1;
      return acc;
    },
    { new_mistake: 0, needs_practice: 0, improving: 0, mastered: 0 },
  );

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Mistakes</h1>
            <p className="text-sm text-muted-foreground">
              Wrong answers land here. Mastery updates as you get them right.
            </p>
          </div>
          {mistakes.length > 0 ? (
            <Button asChild>
              <Link href="/practice">Start practice session</Link>
            </Button>
          ) : null}
        </div>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm">API error: {error}</CardContent>
          </Card>
        ) : null}

        <div className="grid sm:grid-cols-4 gap-3">
          {(Object.keys(counts) as MasteryStatus[]).map((s) => (
            <Card key={s}>
              <CardContent className="pt-4 space-y-1">
                <p className="text-xs uppercase text-muted-foreground">{s.replace(/_/g, " ")}</p>
                <p className="text-2xl font-semibold">{counts[s]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {mistakes.length === 0 && !error ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No mistakes yet</CardTitle>
              <CardDescription>
                Take a quiz first. Wrong answers will show up here automatically.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              {mistakes.map((m) => (
                <div key={m.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">
                      {m.question?.question_text ?? "(question unavailable)"}
                    </p>
                    <Badge variant={statusVariant[m.mastery_status]}>
                      {m.mastery_status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.wrong_count} wrong · {m.correct_after_wrong_count} correct after wrong
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
  );
}
