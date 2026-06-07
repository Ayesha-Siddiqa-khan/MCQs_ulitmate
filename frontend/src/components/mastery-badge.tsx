import { AlertCircle, AlertTriangle, Award, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MasteryStatus } from "@/lib/types";

export const MASTERY_LABEL: Record<MasteryStatus, string> = {
  new_mistake: "New mistake",
  needs_practice: "Needs practice",
  improving: "Improving",
  mastered: "Mastered",
};

export const MASTERY_DESCRIPTION: Record<MasteryStatus, string> = {
  new_mistake: "Recently incorrect questions",
  needs_practice: "Questions you keep getting wrong",
  improving: "Making progress on these",
  mastered: "You've got these down",
};

export const MASTERY_ICON: Record<MasteryStatus, LucideIcon> = {
  new_mistake: AlertCircle,
  needs_practice: AlertTriangle,
  improving: TrendingUp,
  mastered: Award,
};

const VARIANT_CLASSES: Record<MasteryStatus, string> = {
  new_mistake: "bg-red-500 text-white hover:bg-red-500/90",
  needs_practice: "bg-orange-500 text-white hover:bg-orange-500/90",
  improving: "bg-blue-500 text-white hover:bg-blue-500/90",
  mastered: "bg-green-500 text-white hover:bg-green-500/90",
};

const TONE_CLASSES: Record<MasteryStatus, string> = {
  new_mistake: "from-red-500/20 to-red-500/5 border-red-500/40",
  needs_practice: "from-orange-500/20 to-orange-500/5 border-orange-500/40",
  improving: "from-blue-500/20 to-blue-500/5 border-blue-500/40",
  mastered: "from-green-500/20 to-green-500/5 border-green-500/40",
};

const ICON_TONE: Record<MasteryStatus, string> = {
  new_mistake: "text-red-500",
  needs_practice: "text-orange-500",
  improving: "text-blue-500",
  mastered: "text-green-500",
};

export function masteryTone(status: MasteryStatus): string {
  return TONE_CLASSES[status];
}

export function masteryIconTone(status: MasteryStatus): string {
  return ICON_TONE[status];
}

export function MasteryBadge({
  status,
  className,
}: {
  status: MasteryStatus;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "border-transparent px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        VARIANT_CLASSES[status],
        className,
      )}
    >
      {MASTERY_LABEL[status]}
    </Badge>
  );
}
