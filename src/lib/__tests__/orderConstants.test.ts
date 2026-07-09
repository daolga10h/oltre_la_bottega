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

import { preventivoStage, bozzaStage, materialeStage } from "../orderConstants"

describe("preventivoStage", () => {
  it("maps da_inviare to red", () => {
    expect(preventivoStage("da_inviare")).toBe("red")
  })
  it("maps inviato to yellow", () => {
    expect(preventivoStage("inviato")).toBe("yellow")
  })
  it("maps approvato to green", () => {
    expect(preventivoStage("approvato")).toBe("green")
  })
  it("returns null for non_inviare and unknown values", () => {
    expect(preventivoStage("non_inviare")).toBeNull()
    expect(preventivoStage("qualcosa")).toBeNull()
  })
})

describe("bozzaStage", () => {
  it("maps da_fare to red", () => {
    expect(bozzaStage("da_fare")).toBe("red")
  })
  it("maps inviata and modificata to yellow", () => {
    expect(bozzaStage("inviata")).toBe("yellow")
    expect(bozzaStage("modificata")).toBe("yellow")
  })
  it("maps approvata to green", () => {
    expect(bozzaStage("approvata")).toBe("green")
  })
  it("returns null for non_serve and unknown values", () => {
    expect(bozzaStage("non_serve")).toBeNull()
    expect(bozzaStage("qualcosa")).toBeNull()
  })
})

describe("materialeStage", () => {
  it("maps da_ordinare to red", () => {
    expect(materialeStage("da_ordinare")).toBe("red")
  })
  it("maps ordinato to yellow", () => {
    expect(materialeStage("ordinato")).toBe("yellow")
  })
  it("maps arrivato to green", () => {
    expect(materialeStage("arrivato")).toBe("green")
  })
  it("returns null for non_serve and unknown values", () => {
    expect(materialeStage("non_serve")).toBeNull()
    expect(materialeStage("qualcosa")).toBeNull()
  })
})
