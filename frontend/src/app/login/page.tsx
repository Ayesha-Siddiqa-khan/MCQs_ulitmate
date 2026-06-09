import { redirect } from "next/navigation";
import { LogIn, Sparkles } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex justify-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>
      <Card className="border-2 bg-gradient-to-br from-card to-muted/20 shadow-xl shadow-black/5">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <LogIn className="h-5 w-5" /> Log in
          </CardTitle>
          <CardDescription>Welcome back to MCQ Mentor.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
