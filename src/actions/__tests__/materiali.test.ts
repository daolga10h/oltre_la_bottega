import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

import { getMaterials, saveMaterials, updateMaterial, deleteMaterial, setStock, markOrdered } from "../materiali"

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
  in_magazzino: false,
  carico_totale: "0.000",
  rettifica: "0.000",
  soglia: null,
  ordinato_il: null,
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
    const inseriti = client.from.mock.results[1].value.upsert.mock.calls[0][0]
    expect(inseriti).toHaveLength(2)
    expect(inseriti[0]).toMatchObject({
      fornitore: "FB Targhe",
      codice: "003553",
      prezzo_attuale: 14.38,
      data_acquisto_attuale: "2026-01-10",
      prezzo_precedente: null,
      data_acquisto_precedente: null,
    })
    expect(inseriti[0]).toHaveProperty("id", expect.any(String))
  })

  it("aggiorna un materiale esistente con prezzo diverso e sposta l'attuale in precedente", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [riga()], error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([{ codice: "003553", nome: "Targa 003 20x15", prezzo: 15.1 }]))

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 1 })
    expect(client.from).toHaveBeenCalledTimes(2) // lettura + un solo upsert
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
    const inseriti = client.from.mock.results[1].value.upsert.mock.calls[0][0]
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

describe("getMaterials — campi del magazzino", () => {
  afterEach(() => jest.clearAllMocks())

  it("converte giacenza, scorta minima e data di ordine", async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        materiali: [{ data: [riga({ in_magazzino: true, carico_totale: "50.000", rettifica: "-3.000", soglia: "10.000", ordinato_il: "2026-10-25" })], error: null }],
      })
    )
    const [m] = await getMaterials()
    expect(m).toMatchObject({ in_magazzino: true, carico_totale: 50, rettifica: -3, soglia: 10, ordinato_il: "2026-10-25" })
  })
})

describe("saveMaterials — magazzino", () => {
  afterEach(() => jest.clearAllMocks())

  // Con l'impronta la prima chiamata è su documenti_caricati: si cerca la n-esima chiamata di una tabella.
  const builderDi = (client: ReturnType<typeof createSupabaseMock>, table: string, n = 0) => {
    const indici = client.from.mock.calls.flatMap((c, i) => (c[0] === table ? [i] : []))
    return client.from.mock.results[indici[n]].value
  }

  const rigaMag = (over: Record<string, unknown> = {}) => ({
    codice: "111383", nome: "8913 IMPRINT NERO", unita: "PZ", prezzo: 4.65, carica: 50, ...over,
  })

  it("rifiuta una quantità da caricare negativa o non numerica", async () => {
    expect((await saveMaterials(input([rigaMag({ carica: -1 })]))).ok).toBe(false)
    expect((await saveMaterials(input([rigaMag({ carica: Number.NaN })]))).ok).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("materiale nuovo in magazzino: parte dalla quantità caricata e registra l'impronta", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: null }],
      documenti_caricati: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag()], { impronta: "abc123" }))

    expect(r).toEqual({ ok: true, nuovi: 1, aggiornati: 0 })
    const inseriti = builderDi(client, "materiali", 1).upsert.mock.calls[0][0]
    expect(inseriti[0]).toMatchObject({ in_magazzino: true, carico_totale: 50, rettifica: 0, soglia: null, ordinato_il: null })
    expect(builderDi(client, "documenti_caricati").insert).toHaveBeenCalledWith({ impronta: "abc123" })
  })

  it("materiale esistente: somma la quantità e cancella «Ho già ordinato»", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ codice: "111383", nome: "8913 IMPRINT NERO", in_magazzino: true, carico_totale: "20.000", ordinato_il: "2026-10-20" })], error: null },
        { data: null, error: null },
      ],
      documenti_caricati: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ carica: 30 })], { impronta: "abc123", data: "2025-10-29" }))

    const aggiornati = builderDi(client, "materiali", 1).upsert.mock.calls[0][0]
    expect(aggiornati[0]).toMatchObject({ carico_totale: 50, ordinato_il: null, in_magazzino: true })
  })

  it("documento già caricato: non somma le quantità e lo segnala, ma aggiorna i prezzi", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ codice: "111383", nome: "8913 IMPRINT NERO", in_magazzino: true, carico_totale: "50.000" })], error: null },
        { data: null, error: null },
      ],
      documenti_caricati: [{ data: null, error: { code: "23505", message: "duplicate key" } }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag({ prezzo: 5.2 })], { impronta: "abc123", data: "2026-01-10" }))

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 1, quantitaSaltate: true })
    const aggiornati = builderDi(client, "materiali", 1).upsert.mock.calls[0][0]
    expect(aggiornati[0]).toMatchObject({ prezzo_attuale: 5.2, carico_totale: 50 })
  })

  it("«Carica comunque»: somma le quantità anche se l'impronta esiste già", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ codice: "111383", nome: "8913 IMPRINT NERO", in_magazzino: true, carico_totale: "50.000" })], error: null },
        { data: null, error: null },
      ],
      documenti_caricati: [{ data: null, error: { code: "23505", message: "duplicate key" } }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag()], { impronta: "abc123", caricaComunque: true, data: "2025-10-29" }))

    expect(r).toEqual({ ok: true, nuovi: 0, aggiornati: 1 })
    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ carico_totale: 100 })
  })

  it("materiale escluso dall'utente (in_magazzino falso): le quantità non si sommano e resta escluso", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ codice: "111383", nome: "8913 IMPRINT NERO", in_magazzino: false, carico_totale: "0.000" })], error: null },
        { data: null, error: null },
      ],
      documenti_caricati: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ prezzo: 5.2 })], { impronta: "abc123", data: "2026-01-10" }))

    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ in_magazzino: false, carico_totale: 0 })
  })

  it("un materiale nuovo si conta sempre (in_magazzino vero) e parte dalla quantità caricata", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [], error: null }, { data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag()]))

    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ in_magazzino: true, carico_totale: 50 })
  })

  it("se la quantità è vuota non somma nulla e non registra l'impronta", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [], error: null }, { data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ carica: null })], { impronta: "abc123" }))

    expect(client.from.mock.calls.some((c) => c[0] === "documenti_caricati")).toBe(false)
    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ carico_totale: 0 })
  })

  it("usa il nome del fornitore già in elenco: un materiale nuovo di «eljte di Morsia Carlo» va sotto «Eljte»", async () => {
    const client = createSupabaseMock({
      materiali: [
        { data: [riga({ fornitore: "Eljte", codice: "52079", nome: "MEDAGLIETTA" })], error: null },
        { data: null, error: null },
      ],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([{ codice: "24079", nome: "BRACCIALE", prezzo: 2.04 }], { fornitore: "eljte di Morsia Carlo" }))

    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ fornitore: "Eljte", codice: "24079" })
  })

  it("senza impronta (inserimento a mano) somma la quantità senza controllo dei doppi", async () => {
    const client = createSupabaseMock({ materiali: [{ data: [], error: null }, { data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag()]))

    expect(r).toEqual({ ok: true, nuovi: 1, aggiornati: 0 })
    expect(client.from.mock.calls.some((c) => c[0] === "documenti_caricati")).toBe(false)
    expect(builderDi(client, "materiali", 1).upsert.mock.calls[0][0][0]).toMatchObject({ carico_totale: 50 })
  })

  it("se la scrittura dei materiali fallisce toglie l'impronta appena registrata", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: { message: "boom" } }],
      documenti_caricati: [{ data: null, error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await saveMaterials(input([rigaMag()], { impronta: "abc123" }))

    expect(r.ok).toBe(false)
    const rimozione = builderDi(client, "documenti_caricati", 1)
    expect(rimozione.delete).toHaveBeenCalled()
    expect(rimozione.eq).toHaveBeenCalledWith("impronta", "abc123")
  })

  it("stesso materiale due volte nello stesso documento: le quantità si sommano una volta per riga", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: [], error: null }, { data: null, error: null }],
      documenti_caricati: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await saveMaterials(input([rigaMag({ carica: 20 }), rigaMag({ carica: 30 })], { impronta: "abc123" }))

    const inseriti = builderDi(client, "materiali", 1).upsert.mock.calls[0][0]
    expect(inseriti).toHaveLength(1)
    expect(inseriti[0]).toMatchObject({ carico_totale: 50 })
  })
})

describe("updateMaterial — magazzino", () => {
  afterEach(() => jest.clearAllMocks())
  const campi = { nome: "Timbro", unita: "PZ", prezzo_attuale: 4.65, prezzo_precedente: null }

  it("salva la casella e la scorta minima quando sono indicate", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const r = await updateMaterial("m1", { ...campi, in_magazzino: true, soglia: 10 })

    expect(r).toEqual({ ok: true })
    expect(client.from.mock.results[0].value.update).toHaveBeenCalledWith(
      expect.objectContaining({ in_magazzino: true, soglia: 10 })
    )
  })

  it("accetta una scorta minima vuota (null) e rifiuta una negativa", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: null }] }))
    expect((await updateMaterial("m1", { ...campi, soglia: null })).ok).toBe(true)
    expect((await updateMaterial("m1", { ...campi, soglia: -1 })).ok).toBe(false)
  })
})

describe("setStock", () => {
  afterEach(() => jest.clearAllMocks())

  it("rifiuta un valore non valido senza toccare il database", async () => {
    expect((await setStock("m1", -1)).ok).toBe(false)
    expect((await setStock("m1", Number.NaN)).ok).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("calcola la rettifica che porta la giacenza al valore contato", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: { carico_totale: "50.000", rettifica: "0.000" }, error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const r = await setStock("m1", 47)

    expect(r).toEqual({ ok: true })
    expect(client.from.mock.results[1].value.update).toHaveBeenCalledWith({ rettifica: -3 })
    expect(client.from.mock.results[1].value.eq).toHaveBeenCalledWith("id", "m1")
  })

  it("se la giacenza corretta supera quella calcolata (merce arrivata) toglie «Ho già ordinato»", async () => {
    const client = createSupabaseMock({
      materiali: [{ data: { carico_totale: "50.000", rettifica: "0.000" }, error: null }, { data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    await setStock("m1", 60)

    expect(client.from.mock.results[1].value.update).toHaveBeenCalledWith({ rettifica: 10, ordinato_il: null })
  })

  it("errore se il materiale non si legge", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: { message: "boom" } }] }))
    expect((await setStock("m1", 5)).ok).toBe(false)
  })
})

describe("markOrdered", () => {
  afterEach(() => jest.clearAllMocks())

  it("scrive la data di oggi (calendario di Roma)", async () => {
    const client = createSupabaseMock({ materiali: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    expect(await markOrdered("m1")).toEqual({ ok: true })
    const payload = client.from.mock.results[0].value.update.mock.calls[0][0]
    expect(payload.ordinato_il).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(client.from.mock.results[0].value.eq).toHaveBeenCalledWith("id", "m1")
  })

  it("restituisce un errore se la scrittura fallisce", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ materiali: [{ data: null, error: { message: "boom" } }] }))
    expect((await markOrdered("m1")).ok).toBe(false)
  })
})
