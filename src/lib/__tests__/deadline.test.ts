import { deadlineLevel, DEADLINE_LABELS } from "../deadline"

// 24 set 2026, ore 12:00 a Roma (10:00 UTC)
const NOW = new Date("2026-09-24T10:00:00Z")

describe("deadlineLevel", () => {
  it("returns null when there is no delivery date", () => {
    expect(deadlineLevel(null, "in_lavorazione", NOW)).toBeNull()
    expect(deadlineLevel(undefined, "in_lavorazione", NOW)).toBeNull()
    expect(deadlineLevel("", "in_lavorazione", NOW)).toBeNull()
  })

  it("returns null for delivered orders, even when the date is in the past", () => {
    expect(deadlineLevel("2026-09-20", "consegnato", NOW)).toBeNull()
    expect(deadlineLevel("2026-09-25", "consegnato", NOW)).toBeNull()
  })

  it("returns 'domani' when delivery is tomorrow", () => {
    expect(deadlineLevel("2026-09-25", "in_lavorazione", NOW)).toBe("domani")
  })

  it("returns 'oggi' when delivery is today", () => {
    expect(deadlineLevel("2026-09-24", "in_lavorazione", NOW)).toBe("oggi")
  })

  it("returns 'ritardo' when the delivery date has passed", () => {
    expect(deadlineLevel("2026-09-23", "in_lavorazione", NOW)).toBe("ritardo")
    expect(deadlineLevel("2026-01-01", "in_lavorazione", NOW)).toBe("ritardo")
  })

  it("returns null when delivery is two or more days away", () => {
    expect(deadlineLevel("2026-09-26", "in_lavorazione", NOW)).toBeNull()
    expect(deadlineLevel("2026-12-31", "in_lavorazione", NOW)).toBeNull()
  })

  it.each(["preventivo", "bozza_grafica", "da_fare", "in_lavorazione"])(
    "signals domani, oggi and ritardo for status %s",
    (status) => {
      expect(deadlineLevel("2026-09-25", status, NOW)).toBe("domani")
      expect(deadlineLevel("2026-09-24", status, NOW)).toBe("oggi")
      expect(deadlineLevel("2026-09-23", status, NOW)).toBe("ritardo")
    }
  )

  it("never signals domani or oggi for orders that are already 'pronto'", () => {
    expect(deadlineLevel("2026-09-25", "pronto", NOW)).toBeNull()
    expect(deadlineLevel("2026-09-24", "pronto", NOW)).toBeNull()
  })

  it("still signals ritardo for 'pronto' orders", () => {
    expect(deadlineLevel("2026-09-23", "pronto", NOW)).toBe("ritardo")
  })

  it("counts days across a month boundary", () => {
    const endOfMonth = new Date("2026-09-30T10:00:00Z")
    expect(deadlineLevel("2026-10-01", "in_lavorazione", endOfMonth)).toBe("domani")
    expect(deadlineLevel("2026-09-30", "in_lavorazione", endOfMonth)).toBe("oggi")
  })

  it("counts days across a year boundary", () => {
    const endOfYear = new Date("2026-12-31T10:00:00Z")
    expect(deadlineLevel("2027-01-01", "in_lavorazione", endOfYear)).toBe("domani")
  })

  it("uses the Rome calendar day, not the UTC day", () => {
    // 00:30 del 24 set a Roma = 22:30 UTC del 23 set
    const justAfterMidnightInRome = new Date("2026-09-23T22:30:00Z")
    expect(deadlineLevel("2026-09-24", "in_lavorazione", justAfterMidnightInRome)).toBe("oggi")
    expect(deadlineLevel("2026-09-25", "in_lavorazione", justAfterMidnightInRome)).toBe("domani")
    expect(deadlineLevel("2026-09-23", "in_lavorazione", justAfterMidnightInRome)).toBe("ritardo")
  })

  it("stays correct across the end of daylight saving time", () => {
    // Il 25 ott 2026 a Roma si torna all'ora solare (03:00 -> 02:00)
    const beforeChange = new Date("2026-10-25T00:30:00Z") // 02:30 del 25 ott (ora legale)
    const afterChange = new Date("2026-10-25T23:30:00Z") // 00:30 del 26 ott (ora solare)
    expect(deadlineLevel("2026-10-25", "in_lavorazione", beforeChange)).toBe("oggi")
    expect(deadlineLevel("2026-10-26", "in_lavorazione", beforeChange)).toBe("domani")
    expect(deadlineLevel("2026-10-26", "in_lavorazione", afterChange)).toBe("oggi")
  })

  it("ignores a time part in the date string", () => {
    expect(deadlineLevel("2026-09-25T00:00:00", "in_lavorazione", NOW)).toBe("domani")
  })

  it("returns null for an unparseable date", () => {
    expect(deadlineLevel("boh", "in_lavorazione", NOW)).toBeNull()
  })
})

describe("DEADLINE_LABELS", () => {
  it("has a human-readable label for every level", () => {
    expect(DEADLINE_LABELS).toEqual({
      domani: "Consegna domani",
      oggi: "Consegna oggi",
      ritardo: "Consegna in ritardo",
    })
  })
})
