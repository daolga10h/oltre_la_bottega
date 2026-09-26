import { assertSafeTarget, hostOf } from "../safety"

describe("hostOf", () => {
  it("estrae l'host da un indirizzo completo", () => {
    expect(hostOf("https://abc.supabase.co/rest/v1?x=1")).toBe("abc.supabase.co")
  })

  it("accetta anche l'indirizzo senza https:// (come in .env.example)", () => {
    expect(hostOf("abc.supabase.co")).toBe("abc.supabase.co")
  })

  it("ignora maiuscole, spazi e barra finale", () => {
    expect(hostOf("  HTTPS://ABC.Supabase.co/ ")).toBe("abc.supabase.co")
  })

  it("restituisce null se manca", () => {
    expect(hostOf(undefined)).toBeNull()
    expect(hostOf("")).toBeNull()
    expect(hostOf("   ")).toBeNull()
  })
})

describe("assertSafeTarget", () => {
  const base = {
    demoUrl: "https://demo.supabase.co",
    prodUrls: ["https://vero.supabase.co", undefined],
    existingOrderCount: 0,
    hasDemoMarkerUser: false,
  }

  it("non fa niente per un database demo vuoto (prima esecuzione)", () => {
    expect(() => assertSafeTarget(base)).not.toThrow()
  })

  it("non fa niente per un database demo già usato (contiene l'utente marcato)", () => {
    expect(() => assertSafeTarget({ ...base, existingOrderCount: 25, hasDemoMarkerUser: true })).not.toThrow()
  })

  it("rifiuta se manca l'indirizzo della demo", () => {
    expect(() => assertSafeTarget({ ...base, demoUrl: undefined })).toThrow(/non tocco niente/)
    expect(() => assertSafeTarget({ ...base, demoUrl: "" })).toThrow(/non tocco niente/)
  })

  it("rifiuta se l'indirizzo è quello del progetto vero, anche scritto in modo diverso", () => {
    expect(() => assertSafeTarget({ ...base, demoUrl: "https://vero.supabase.co" })).toThrow(/bottega vera/)
    expect(() => assertSafeTarget({ ...base, demoUrl: "VERO.supabase.co/" })).toThrow(/bottega vera/)
  })

  it("rifiuta se un qualunque indirizzo 'vero' coincide", () => {
    expect(() =>
      assertSafeTarget({ ...base, prodUrls: [undefined, "https://demo.supabase.co"] })
    ).toThrow(/bottega vera/)
  })

  it("rifiuta un database con ordini ma senza l'utente marcato demo", () => {
    expect(() => assertSafeTarget({ ...base, existingOrderCount: 3, hasDemoMarkerUser: false })).toThrow(
      /non sembra il progetto demo/
    )
  })
})
