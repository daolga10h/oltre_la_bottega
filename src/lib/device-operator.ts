const STORAGE_KEY = "oltreBottegaOperatore"

export function getRememberedOperator(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function setRememberedOperator(nome: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, nome)
  } catch {
    // Private browsing, quota exceeded, o storage disabilitato — scrittura
    // best-effort, la selezione dell'operatore deve funzionare comunque.
  }
}