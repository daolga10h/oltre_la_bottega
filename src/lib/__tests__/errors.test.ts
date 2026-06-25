import { AppError, toUserMessage, USER_MESSAGES } from "../errors"

describe("toUserMessage", () => {
  it("returns AppError userMessage when AppError is passed", () => {
    const err = new AppError("technical msg", USER_MESSAGES.saveFailed)
    expect(toUserMessage(err)).toBe(USER_MESSAGES.saveFailed)
  })

  it("returns generic message for unknown errors", () => {
    expect(toUserMessage(new Error("db timeout"))).toBe(USER_MESSAGES.generic)
    expect(toUserMessage("string error")).toBe(USER_MESSAGES.generic)
  })
})
