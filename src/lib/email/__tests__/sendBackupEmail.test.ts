const mockSend = jest.fn()
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

import { sendBackupEmail } from "@/lib/email/sendBackupEmail"

describe("sendBackupEmail", () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    mockSend.mockClear()
  })
  afterEach(() => {
    process.env = OLD_ENV
  })

  it("does nothing when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY
    await expect(
      sendBackupEmail({ to: "bottega@example.com", csv: "a,b\n1,2", shopName: "La Bottega" })
    ).resolves.toBeUndefined()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("sends the CSV as a base64 attachment when RESEND_API_KEY is configured", async () => {
    process.env.RESEND_API_KEY = "test-key"
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null })

    await sendBackupEmail({ to: "bottega@example.com", csv: "a,b\n1,2", shopName: "La Bottega" })

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe("bottega@example.com")
    expect(call.attachments[0].content).toBe(Buffer.from("a,b\n1,2").toString("base64"))
  })

  it("throws when Resend returns an error", async () => {
    process.env.RESEND_API_KEY = "test-key"
    mockSend.mockResolvedValue({ data: null, error: { message: "invalid api key" } })

    await expect(
      sendBackupEmail({ to: "bottega@example.com", csv: "a,b\n1,2", shopName: "La Bottega" })
    ).rejects.toThrow()
  })
})
