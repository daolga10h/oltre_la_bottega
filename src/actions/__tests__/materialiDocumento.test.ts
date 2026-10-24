import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

const mockRead = jest.fn()
jest.mock("@/lib/documentReader", () => ({
  readSupplierDocument: (...args: unknown[]) => mockRead(...args),
}))

import { extractDocument } from "../materialiDocumento"
import { MAX_FILE_BYTES } from "@/lib/documentoFornitore"

function formDataWith(file: File | string | null): FormData {
  const fd = new FormData()
  if (file !== null) fd.append("file", file)
  return fd
}

const pdf = () => new File(["%PDF-1.4 finto"], "fattura.pdf", { type: "application/pdf" })

describe("extractDocument", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "chiave-di-prova"
    mockCreateClient.mockResolvedValue(createSupabaseMock({}))
  })

  afterEach(() => {
    jest.clearAllMocks()
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalKey
  })

  it("rifiuta se non c'è un utente autenticato", async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({}, { user: null }))
    const r = await extractDocument(formDataWith(pdf()))
    expect(r.ok).toBe(false)
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("rifiuta con un messaggio chiaro se la chiave non è configurata", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const r = await extractDocument(formDataWith(pdf()))
    expect(r).toEqual({ ok: false, error: expect.stringContaining("non è configurata") })
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("rifiuta se manca il file", async () => {
    const r = await extractDocument(formDataWith(null))
    expect(r.ok).toBe(false)
  })

  it("rifiuta un formato non supportato", async () => {
    const r = await extractDocument(formDataWith(new File(["x"], "a.docx", { type: "application/msword" })))
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Formato non supportato") })
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("rifiuta un file troppo grande", async () => {
    const grande = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "grande.pdf", { type: "application/pdf" })
    const r = await extractDocument(formDataWith(grande))
    expect(r).toEqual({ ok: false, error: expect.stringContaining("troppo grande") })
    expect(mockRead).not.toHaveBeenCalled()
  })

  it("passa al lettore il file in base64 col suo tipo e restituisce il documento", async () => {
    const documento = { fornitore: "FB", data: "2025-10-29", righe: [] }
    mockRead.mockResolvedValue(documento)

    const r = await extractDocument(formDataWith(pdf()))

    expect(r).toEqual({ ok: true, documento })
    expect(mockRead).toHaveBeenCalledWith(Buffer.from("%PDF-1.4 finto").toString("base64"), "application/pdf")
  })

  it("se il lettore fallisce restituisce un messaggio che propone l'inserimento a mano", async () => {
    mockRead.mockRejectedValue(new Error("timeout"))
    const r = await extractDocument(formDataWith(pdf()))
    expect(r).toEqual({ ok: false, error: expect.stringContaining("a mano") })
  })
})
