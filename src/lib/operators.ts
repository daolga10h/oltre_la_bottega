import type { User } from "@supabase/supabase-js"

export function getOperatorNames(user: User | null): string[] {
  const value = user?.user_metadata?.operatori
  return Array.isArray(value) ? value : []
}

export function addOperatorName(current: string[], candidate: string): string[] {
  const trimmed = candidate.trim()
  if (!trimmed) return current
  if (current.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return current
  return [...current, trimmed]
}

export function removeOperatorName(current: string[], name: string): string[] {
  return current.filter((o) => o !== name)
}