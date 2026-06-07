import { NavBar } from "@/components/nav-bar";
import { getCurrentUser } from "@/lib/auth";

export async function AppNav() {
  const user = await getCurrentUser();
  return <NavBar user={user} />;
}
