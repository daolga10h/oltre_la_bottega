export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
  console.error(`[${new Date().toISOString()}] [ERROR] [${context}]`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...meta,
  })
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  const prefix = `[${new Date().toISOString()}] [INFO] [${context}] ${message}`
  if (meta !== undefined) {
    console.log(prefix, meta)
  } else {
    console.log(prefix)
  }
}
