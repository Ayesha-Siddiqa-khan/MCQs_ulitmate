import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, UserPlus } from "lucide-react";

import { SignUpForm } from "@/app/signup/signup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export default async function SignUpPage() {
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
            <UserPlus className="h-5 w-5" /> Create your account
          </CardTitle>
          <CardDescription>
            You can add an AI key on the Settings page after signing up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
