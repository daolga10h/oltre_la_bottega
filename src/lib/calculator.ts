export type CalculatorOperator = "+" | "-" | "×" | "÷"

export function applyOperator(a: number, op: CalculatorOperator, b: number): number | null {
  switch (op) {
    case "+":
      return a + b
    case "-":
      return a - b
    case "×":
      return a * b
    case "÷":
      return b === 0 ? null : a / b
  }
}
