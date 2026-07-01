import { cn } from "@/lib/utils"

interface ErrorMessageProps {
  message: string
  className?: string
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive",
        className
      )}
    >
      {message}
    </div>
  )
}
