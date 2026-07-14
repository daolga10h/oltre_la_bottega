const STORAGE_KEY = "oltreBottegaEmail"

export function getRememberedEmail(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function setRememberedEmail(email: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, email)
  } catch {
    // Private browsing, quota exceeded, or storage disabled — the write is
    // best-effort. Login must still succeed even if the email can't be remembered.
  }
}