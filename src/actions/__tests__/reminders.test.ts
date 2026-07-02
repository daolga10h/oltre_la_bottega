import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

import { getActiveReminders, completeReminder } from "../reminders"

describe("getActiveReminders", () => {
  afterEach(() => jest.clearAllMocks())

  it("requests active reminders OR reminders completed today (not before)", async () => {
    const client = createSupabaseMock({ reminders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getActiveReminders()

    const builder = client.from.mock.results[0].value
    const orCall = builder.or.mock.calls[0][0] as string

    expect(orCall).toContain("status.eq.attivo")
    expect(orCall).toContain("status.eq.completato")
    // the completed_at lower bound must be midnight of today, not an arbitrary time
    const match = orCall.match(/completed_at\.gte\.(.+)\)$/)
    expect(match).not.toBeNull()
    const bound = new Date(match![1])
    expect(bound.getHours()).toBe(0)
    expect(bound.getMinutes()).toBe(0)
    expect(bound.getSeconds()).toBe(0)
  })

  it("returns rows mapped from the query result", async () => {
    const rows = [{ id: "1", title: "Chiama fornitore", due_at: "2026-07-02T10:00:00Z", status: "attivo", order_id: null, completed_at: null }]
    const client = createSupabaseMock({ reminders: [{ data: rows, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const result = await getActiveReminders()
    expect(result).toEqual(rows)
  })

  it("throws a user-facing AppError when the query fails", async () => {
    const client = createSupabaseMock({ reminders: [{ data: null, error: { message: "connection refused" } }] })
    mockCreateClient.mockResolvedValue(client)
    jest.spyOn(console, "error").mockImplementation(() => {})

    await expect(getActiveReminders()).rejects.toThrow()
  })
})

describe("completeReminder", () => {
  afterEach(() => jest.clearAllMocks())

  it("sets status to completato and stamps completed_at", async () => {
    const client = createSupabaseMock({ reminders: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await completeReminder("abc")

    const builder = client.from.mock.results[0].value
    const updatePayload = builder.update.mock.calls[0][0]
    expect(updatePayload.status).toBe("completato")
    expect(updatePayload.completed_at).toEqual(expect.any(String))
    expect(new Date(updatePayload.completed_at).toString()).not.toBe("Invalid Date")
    expect(builder.eq).toHaveBeenCalledWith("id", "abc")
  })

  it("throws when the update fails, so the UI can roll back its optimistic state", async () => {
    const client = createSupabaseMock({ reminders: [{ data: null, error: { message: "db down" } }] })
    mockCreateClient.mockResolvedValue(client)
    jest.spyOn(console, "error").mockImplementation(() => {})

    await expect(completeReminder("abc")).rejects.toThrow()
  })
})
