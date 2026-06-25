export class AppError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = "AppError"
  }
}

export const USER_MESSAGES = {
  generic: "Si è verificato un errore. Riprova tra qualche secondo.",
  saveFailed: "Impossibile salvare i dati. Controlla la connessione e riprova.",
  notFound: "Elemento non trovato. Potrebbe essere stato eliminato.",
  authRequired: "Per accedere è necessario effettuare il login.",
  validationError: "Controlla i campi del modulo prima di continuare.",
  featureUnavailable: "Funzione temporaneamente non disponibile. Riprova più tardi.",
} as const

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage
  return USER_MESSAGES.generic
}
