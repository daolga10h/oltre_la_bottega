// Replica il pattern di chaining di @supabase/supabase-js: ogni metodo del
// query builder ritorna `this` ed è "thenable" — l'esecuzione avviene solo
// quando la catena viene awaitata, indipendentemente da quali metodi sono
// stati chiamati prima.

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null }

const CHAIN_METHODS = [
  "select", "insert", "update", "delete",
  "eq", "neq", "or", "lt", "lte", "gte", "not", "ilike", "order",
] as const

export function createQueryBuilder(result: QueryResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {}
  for (const method of CHAIN_METHODS) {
    builder[method] = jest.fn(() => builder)
  }
  builder.single = jest.fn(() => Promise.resolve(result))
  builder.then = (
    onFulfilled?: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

/**
 * Costruisce un client Supabase finto. `responsesByTable` fornisce, per ogni
 * tabella, la coda di risultati da restituire nell'ordine in cui `.from(table)`
 * viene invocato — utile per query multiple sulla stessa tabella (es. Promise.all
 * con più conteggi su "orders").
 */
export function createSupabaseMock(
  responsesByTable: Record<string, QueryResult[]>,
  options?: { user?: { id: string } | null }
) {
  const callCounts: Record<string, number> = {}
  const from = jest.fn((table: string) => {
    const idx = callCounts[table] ?? 0
    callCounts[table] = idx + 1
    const queue = responsesByTable[table] ?? []
    const result = queue[idx] ?? queue[queue.length - 1] ?? { data: null, error: null }
    return createQueryBuilder(result)
  })

  // `"user" in options` (not `??`) so an explicit `{ user: null }` simulates
  // "no authenticated user" instead of falling through to the default.
  const user = options && "user" in options ? (options.user ?? null) : { id: "test-user" }

  return {
    from,
    auth: {
      getUser: jest.fn(
        (): Promise<{ data: { user: { id: string } | null } }> =>
          Promise.resolve({ data: { user } })
      ),
    },
  }
}
