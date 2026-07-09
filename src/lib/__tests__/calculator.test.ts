import { applyOperator } from "../calculator"

describe("applyOperator", () => {
  it("adds two numbers", () => {
    expect(applyOperator(4, "+", 6)).toBe(10)
  })

  it("subtracts two numbers", () => {
    expect(applyOperator(10, "-", 3)).toBe(7)
  })

  it("multiplies two numbers", () => {
    expect(applyOperator(4, "×", 5)).toBe(20)
  })

  it("divides two numbers", () => {
    expect(applyOperator(10, "÷", 2)).toBe(5)
  })

  it("returns null when dividing by zero", () => {
    expect(applyOperator(5, "÷", 0)).toBeNull()
  })

  it("chains sequentially without operator precedence (4 + 6 then × 2 = 20, not 16)", () => {
    const step1 = applyOperator(4, "+", 6)
    expect(step1).toBe(10)
    const step2 = applyOperator(step1 as number, "×", 2)
    expect(step2).toBe(20)
  })
})
