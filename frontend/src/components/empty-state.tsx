import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-2 border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center sm:py-16">
        <div
          className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted",
            iconClassName,
          )}
        >
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? (
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
