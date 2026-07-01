import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isTomorrow, isPast } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy")
}

export function formatEUR(value: number): string {
  return value.toFixed(2)
}

export function isOverdue(dueDate: string): boolean {
  const d = new Date(dueDate)
  return isPast(d) && !isToday(d)
}

export function dueDateLabel(dueDate: string): string {
  const d = new Date(dueDate)
  if (isToday(d)) return "Oggi"
  if (isTomorrow(d)) return "Domani"
  if (isOverdue(dueDate)) return "In ritardo"
  return formatDate(dueDate)
}
