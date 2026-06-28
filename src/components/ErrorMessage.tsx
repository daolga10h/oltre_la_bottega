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
        "rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700",
        className
      )}
    >
      {message}
    </div>
  )
}
