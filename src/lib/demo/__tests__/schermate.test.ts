import { SCHERMATE_RU } from "../schermate"

describe("schermate per la presentazione in russo", () => {
  it("sono sei, nell'ordine previsto dal design", () => {
    expect(SCHERMATE_RU.map((s) => s.id)).toEqual(["oggi", "nuovo-ordine", "bacheca", "avvisa", "foglio", "cliente"])
  })

  it("ogni didascalia è non vuota, in cirillico e non più lunga di 95 caratteri", () => {
    for (const s of SCHERMATE_RU) {
      expect(s.didascalia.trim().length).toBeGreaterThan(0)
      expect(s.didascalia.length).toBeLessThanOrEqual(95)
      expect(s.didascalia).toMatch(/[Ѐ-ӿ]/)
    }
  })

  it("gli identificativi non si ripetono (servono per i nomi dei file)", () => {
    const id = SCHERMATE_RU.map((s) => s.id)
    expect(new Set(id).size).toBe(id.length)
  })
})
