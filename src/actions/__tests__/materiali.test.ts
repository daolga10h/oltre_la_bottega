import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

import { getMaterials, saveMaterials, updateMaterial, deleteMaterial } from "../materiali"

const riga = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  fornitore: "FB Targhe",
  codice: "003553",
  nome: "Targa 003 Tutta Silver 20x15",
  unita: "Nr.",
  prezzo_attuale: "14.380", // Supabase può restituire i numeric come stringhe
  data_acquisto_attuale: "2025-10-29",
  prezzo_precedente: null,
  data_acquisto_precedente: null,
  ...over,
})

const input = (righe: Array<Record<string, unknown>>, over: Record<string, unknown> = {}) => ({
  fornitore: "FB Targhe",
  data: "2026-01-10",
  righe: righe.map((r) => ({ codice: null, unita: null, ...r })),
  ...over,
}) as Parameters<typeof saveMaterials>[0]

describe("getMaterials", () => {
  afterEach(() => jest.clearAllMocks())

  it("converte i prezzi in numeri", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ materiali: [{ data: [riga({ prezzo_precedente: "13.900", data_acquisto_precedente: "2025-05-12" })], error: null }] })
    )
    const [m] = await getMaterials()
    expect(m.prezzo_attuale).toBe(14.38)
    expect(m.prezzo_precedente).toBe(13.9)
  })

  it("lancia un errore generico se la query fallisce", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: { message: "boom" } }] }))
    await expect(getMaterials()).rejects.toThrow()
  })
})

describe("saveMaterials", () => {
  afterEach(() => jest.clearAllMocks())

  it("rifiuta dati non validi senza toccare il database", async () => {
    const r1 = await saveMaterials(input([{ nome: "A", prezzo: 1 }], { fornitore: "  " }))
    const r2 = await saveMaterials(input([{ nome: "A", prezzo: 1 }], { data: "10/01/2026" }))
    const r3 = await saveMaterials(input([]))
    const r4 = await saveMaterials(input([{ nome: " ", prezzo: 1 }]))
    const r5 = await saveMaterials(input([{ nome: "A", prezzo: -2 }]))
    for (const r of [r1, r2, r3, r4, r5]) expect(r.ok).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("rifiuta se non c'è un utente autenticato", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({}, { user: null }))
    const r = await saveMaterials(input([{ nome: "A", prezzo: 1 }]))
    expect(r.ok).toBe(false)
  })

  it("inserisce i materiali nuovi", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(
      input([
        { codice: "003553", nome: "Targa 003 20x15", unita: "Nr.", prezzo: 14.38 },
        { codice: "003554", nome: "Targa 003 24x18", unita: "Nr.", prezzo: 23.05 },
      ])
    )

    expect(r).toEqual({ ok: true, nuovi: 2, aggiornati: 0 })
    const inseriti = client.from.mock.results[1].value.insert.mock.calls[0][0]
    expect(inseriti).toHaveLength(2)
    expect(inseriti[0]).toMatchObject({
      fornitore: "FB Targhe",
      codice: "003553",
      prezzo_attuale: 14.38,
      data_acquisto_attuale: "2026-01-10",
      prezzo_precedente: null,
      data_acquisto_precedente: null,
    })
    expect(inseriti[0]).not.toHaveProperty("id")
  })

  it("aggiorna un materiale esistente con prezzo diverso e sposta l'attuale in precedente", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [riga()], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([{ codice: "003553", nome: "Targa 003 20x15", prezzo: 15.1 }]))

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 1 })
    expect(client.from).toHaveBeenCalledTimes(2) // lettura + upsert, nessun insert
    const aggiornati = client.from.mock.results[1].value.upsert.mock.calls[0][0]
    expect(aggiornati).toEqual([
      expect.objectContaining({
        id: "m1",
        prezzo_attuale: 15.1,
        data_acquisto_attuale: "2026-01-10",
        prezzo_precedente: 14.38,
        data_acquisto_precedente: "2025-10-29",
      }),
    ])
  })

  it("non scrive nulla se prezzo e data sono già quelli salvati (ricaricare lo stesso documento è sicuro)", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [riga()], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(
      input([{ codice: "003553", nome: "Targa 003 20x15", prezzo: 14.38 }], { data: "2025-10-29" })
    )

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 0 })
    expect(client.from).toHaveBeenCalledTimes(1)
  })

  it("completa il codice mancante di un materiale inserito a mano", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [riga({ codice: null })], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([{ codice: "003553", nome: "Targa 003 Tutta Silver 20x15", prezzo: 14.38 }], { data: "2025-10-29" }))

    const aggiornati = client.from.mock.results[1].value.upsert.mock.calls[0][0]
    expect(aggiornati[0]).toMatchObject({ id: "m1", codice: "003553" })
  })

  it("lo stesso codice due volte nello stesso documento dà un solo materiale", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(
      input([
        { codice: "A1", nome: "Articolo", prezzo: 10 },
        { codice: "A1", nome: "Articolo", prezzo: 12 },
      ])
    )

    expect(r).toEqual({ ok: true, nuovi: 1, aggiornati: 0 })
    const inseriti = client.from.mock.results[1].value.insert.mock.calls[0][0]
    expect(inseriti).toHaveLength(1)
    expect(inseriti[0]).toMatchObject({ prezzo_attuale: 12, prezzo_precedente: 10 })
  })

  it("restituisce un errore se l'inserimento fallisce", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        materiali: [{ data: [], error: null }, { data: null, error: { message: "boom" } }],
      })
    )
    const r = await saveMaterials(input([{ nome: "A", prezzo: 1 }]))
    expect(r.ok).toBe(false)
  })
})

describe("updateMaterial", () => {
  afterEach(() => jest.clearAllMocks())
  const campi = { nome: "Targa", unita: "Nr.", prezzo_attuale: 15, prezzo_precedente: 14 }

  it("rifiuta nome vuoto o prezzi non validi", async () => {
    expect((await updateMaterial("m1", { ...campi, nome: " " })).ok).toBe(false)
    expect((await updateMaterial("m1", { ...campi, prezzo_attuale: -1 })).ok).toBe(false)
    expect((await updateMaterial("m1", { ...campi, prezzo_precedente: -1 })).ok).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("corregge i campi direttamente", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const r = await updateMaterial("m1", campi)

    expect(r).toEqual({ ok: true })
    const builder = client.from.mock.results[0].value
    expect(builder.update).toHaveBeenCalledWith({ nome: "Targa", unita: "Nr.", prezzo_attuale: 15, prezzo_precedente: 14 })
    expect(builder.eq).toHaveBeenCalledWith("id", "m1")
  })

  it("togliendo il prezzo precedente azzera anche la sua data", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await updateMaterial("m1", { ...campi, prezzo_precedente: null })

    expect(client.from.mock.results[0].value.update).toHaveBeenCalledWith(
      expect.objectContaining({ prezzo_precedente: null, data_acquisto_precedente: null })
    )
  })
})

describe("deleteMaterial", () => {
  afterEach(() => jest.clearAllMocks())

  it("elimina per id", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    expect(await deleteMaterial("m1")).toEqual({ ok: true })
    const builder = client.from.mock.results[0].value
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith("id", "m1")
  })

  it("restituisce un errore se la cancellazione fallisce", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: { message: "boom" } }] }))
    expect((await deleteMaterial("m1")).ok).toBe(false)
  })
})
