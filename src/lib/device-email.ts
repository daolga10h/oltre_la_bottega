const STORAGE_KEY = "oltreBottegaEmail"

export function getRememberedEmail(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function setRememberedEmail(email: string): void {
  window.localStorage.setItem(STORAGE_KEY, email)
}