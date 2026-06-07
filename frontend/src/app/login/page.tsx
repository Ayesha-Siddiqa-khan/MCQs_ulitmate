import Link from "next/link";
import { redirect } from "next/navigation";
import { LogIn, Sparkles } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="mb-6 flex justify-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground shadow-lg">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>
      <Card className="border-2">
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
      <p className="mt-4 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
