import { type LucideIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QuickContactLinkProps {
  href: string | null
  icon: LucideIcon
  label: string
  external?: boolean
  variant?: "toolbar" | "table"
  onClick?: () => void
}

export function QuickContactLink({ href, icon: Icon, label, external = false, variant = "table", onClick }: QuickContactLinkProps) {
  if (!href) return null
  return (
    <a
      href={href}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        variant === "toolbar"
          ? "inline-flex items-center gap-1 bg-card"
          : "w-full text-xs inline-flex items-center justify-center gap-1"
      )}
    >
      <Icon className={variant === "toolbar" ? "w-3.5 h-3.5" : "w-3 h-3"} />{label}
    </a>
  )
}
