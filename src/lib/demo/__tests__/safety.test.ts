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

  it("ignora credenziali, porta e frammento", () => {
    expect(hostOf("https://u:p@VERO.supabase.co:443/x#y")).toBe("vero.supabase.co")
  })

  it("ignora il punto finale del nome host", () => {
    expect(hostOf("vero.supabase.co.")).toBe("vero.supabase.co")
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
    existingUserCount: 0,
    hasDemoMarkerUser: false,
  }

  it("non fa niente per un database demo vuoto (prima esecuzione)", () => {
    expect(() => assertSafeTarget(base)).not.toThrow()
  })

  it("non fa niente per un database demo già usato (contiene l'utente marcato)", () => {
    expect(() => assertSafeTarget({ ...base, existingOrderCount: 25, existingUserCount: 1, hasDemoMarkerUser: true })).not.toThrow()
  })

  it("rifiuta se manca l'indirizzo della demo", () => {
    expect(() => assertSafeTarget({ ...base, demoUrl: undefined })).toThrow(/non tocco niente/)
    expect(() => assertSafeTarget({ ...base, demoUrl: "" })).toThrow(/non tocco niente/)
    expect(() => assertSafeTarget({ ...base, demoUrl: "   " })).toThrow(/non tocco niente/)
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

  it("rifiuta un database senza ordini ma con utenti e senza l'utente marcato demo", () => {
    expect(() => assertSafeTarget({ ...base, existingOrderCount: 0, existingUserCount: 1, hasDemoMarkerUser: false })).toThrow(
      /non sembra il progetto demo/
    )
  })

  it("non fa niente per un database completamente vuoto (prima esecuzione)", () => {
    expect(() =>
      assertSafeTarget({ ...base, existingOrderCount: 0, existingUserCount: 0, hasDemoMarkerUser: false })
    ).not.toThrow()
  })

  it("rifiuta se l'indirizzo del progetto vero non è noto (fail-closed)", () => {
    expect(() => assertSafeTarget({ ...base, prodUrls: [undefined, ""] })).toThrow(/non tocco niente/)
    expect(() => assertSafeTarget({ ...base, prodUrls: [undefined, ""] })).toThrow(/progetto vero/)
    expect(() => assertSafeTarget({ ...base, prodUrls: [] })).toThrow(/progetto vero/)
  })

  it("l'utente marcato demo non basta se l'indirizzo è quello del progetto vero", () => {
    expect(() =>
      assertSafeTarget({
        ...base,
        demoUrl: "https://vero.supabase.co",
        existingOrderCount: 10,
        existingUserCount: 1,
        hasDemoMarkerUser: true,
      })
    ).toThrow(/bottega vera/)
  })
})
