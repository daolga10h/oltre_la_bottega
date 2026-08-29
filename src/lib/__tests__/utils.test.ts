import { buildClientDisplayName } from "../utils"

describe("buildClientDisplayName", () => {
  it("joins nome and cognome with a space", () => {
    expect(buildClientDisplayName("Mario", "Rossi")).toBe("Mario Rossi")
  })

  it("omits cognome when absent", () => {
    expect(buildClientDisplayName("Mario", null)).toBe("Mario")
  })

  it("appends azienda after an em dash when present", () => {
    expect(buildClientDisplayName("Mario", "Rossi", "ASD Calcio Torino")).toBe(
      "Mario Rossi — ASD Calcio Torino"
    )
  })

  it("omits the azienda suffix when azienda is null or empty", () => {
    expect(buildClientDisplayName("Mario", "Rossi", null)).toBe("Mario Rossi")
    expect(buildClientDisplayName("Mario", "Rossi", "")).toBe("Mario Rossi")
  })
})
