import { getOperatorNames, addOperatorName, removeOperatorName } from "@/lib/operators"
import type { User } from "@supabase/supabase-js"

function makeUser(operatori?: unknown): User {
  return {
    user_metadata: operatori === undefined ? {} : { operatori },
  } as User
}

describe("getOperatorNames", () => {
  it("returns an empty array when user is null", () => {
    expect(getOperatorNames(null)).toEqual([])
  })

  it("returns an empty array when operatori is not set", () => {
    expect(getOperatorNames(makeUser())).toEqual([])
  })

  it("returns an empty array when operatori is not an array (defensive)", () => {
    expect(getOperatorNames(makeUser("not-an-array"))).toEqual([])
  })

  it("returns the stored list when present", () => {
    expect(getOperatorNames(makeUser(["Maria", "Luca"]))).toEqual(["Maria", "Luca"])
  })
})

describe("addOperatorName", () => {
  it("adds a trimmed name to an empty list", () => {
    expect(addOperatorName([], "  Maria  ")).toEqual(["Maria"])
  })

  it("appends to an existing list without mutating it", () => {
    const current = ["Maria"]
    const result = addOperatorName(current, "Luca")
    expect(result).toEqual(["Maria", "Luca"])
    expect(current).toEqual(["Maria"])
  })

  it("rejects an empty name and returns the same array reference", () => {
    const current = ["Maria"]
    expect(addOperatorName(current, "   ")).toBe(current)
  })

  it("rejects a case-insensitive duplicate and returns the same array reference", () => {
    const current = ["Maria"]
    expect(addOperatorName(current, "maria")).toBe(current)
  })
})

describe("removeOperatorName", () => {
  it("removes an exact match", () => {
    expect(removeOperatorName(["Maria", "Luca"], "Maria")).toEqual(["Luca"])
  })

  it("is a no-op when the name is not in the list", () => {
    expect(removeOperatorName(["Maria"], "Luca")).toEqual(["Maria"])
  })
})