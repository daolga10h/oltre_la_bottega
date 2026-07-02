import { computeOrderStatus, computeSaldo } from "../orderConstants"

describe("computeOrderStatus", () => {
  it("returns 'preventivo' when a quote must be sent, regardless of bozza", () => {
    expect(computeOrderStatus("da_inviare", "da_fare")).toBe("preventivo")
    expect(computeOrderStatus("inviato", "non_serve")).toBe("preventivo")
  })

  it("returns 'bozza_grafica' when no quote is needed but a graphic draft is", () => {
    expect(computeOrderStatus("non_inviare", "da_fare")).toBe("bozza_grafica")
    expect(computeOrderStatus("non_inviare", "inviata")).toBe("bozza_grafica")
  })

  it("returns 'da_fare' when neither quote nor draft is needed", () => {
    expect(computeOrderStatus("non_inviare", "non_serve")).toBe("da_fare")
  })

  it("never returns 'in_lavorazione' directly — orders must be scheduled first", () => {
    const allCombos = [
      ["non_inviare", "non_serve"],
      ["da_inviare", "non_serve"],
      ["non_inviare", "approvata"],
    ]
    for (const [preventivo, bozza] of allCombos) {
      expect(computeOrderStatus(preventivo, bozza)).not.toBe("in_lavorazione")
    }
  })
})

describe("computeSaldo", () => {
  it("subtracts acconto from prezzo", () => {
    expect(computeSaldo(100, 30)).toBe(70)
  })

  it("never returns a negative balance when acconto exceeds prezzo", () => {
    expect(computeSaldo(50, 80)).toBe(0)
  })

  it("returns 0 when both are 0", () => {
    expect(computeSaldo(0, 0)).toBe(0)
  })

  it("handles floating point cents without drifting negative", () => {
    expect(computeSaldo(19.9, 19.9)).toBe(0)
  })
})
