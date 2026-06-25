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
  generic: "Произошла ошибка. Попробуйте ещё раз через несколько секунд.",
  saveFailed: "Не удалось сохранить данные. Проверьте соединение и попробуйте снова.",
  notFound: "Запись не найдена. Возможно, она была удалена.",
  authRequired: "Для доступа необходимо войти в систему.",
  validationError: "Проверьте правильность заполнения формы.",
  featureUnavailable: "Функция временно недоступна. Попробуйте позже.",
} as const

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage
  return USER_MESSAGES.generic
}
