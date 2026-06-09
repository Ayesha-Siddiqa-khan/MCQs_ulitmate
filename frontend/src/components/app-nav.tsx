import { NavBar } from "@/components/nav-bar";
import type { AuthUser } from "@/lib/auth";

interface AppNavProps {
  user: AuthUser | null;
}

export async function AppNav({ user }: AppNavProps) {
  return <NavBar user={user} />;
}
