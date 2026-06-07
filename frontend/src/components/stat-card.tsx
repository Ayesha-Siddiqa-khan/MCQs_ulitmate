import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
  iconClassName?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  iconClassName,
}: StatCardProps) {
  const body = (
    <Card className="h-full border-2 transition-all hover:shadow-md hover:border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={cn("h-5 w-5", iconClassName ?? "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}
