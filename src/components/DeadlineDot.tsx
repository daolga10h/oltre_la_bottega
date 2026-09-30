import { cn } from "@/lib/utils"
import { DEADLINE_LABELS, type DeadlineLevel } from "@/lib/deadline"

export const DEADLINE_CARD_CLASSES: Record<DeadlineLevel, string> = {
  domani: "border-honey bg-[#fef6e4]",
  oggi: "border-gold bg-[#fde7bd]",
  ritardo: "border-terracotta/40 bg-[#fdf0ef]",
}

export function DeadlineDot({ level, className }: { level: DeadlineLevel | null; className?: string }) {
  if (!level) return null

  return (
    <span
      role="img"
      aria-label={DEADLINE_LABELS[level]}
      title={DEADLINE_LABELS[level]}
      className={cn("deadline-dot", `deadline-dot-${level}`, className)}
    />
  )
}
