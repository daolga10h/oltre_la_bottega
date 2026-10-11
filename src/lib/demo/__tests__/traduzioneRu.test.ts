import { DIZIONARIO_RU, REGOLE_RU, creaTraduttore, traduciRu } from "../traduzioneRu"

describe("traduciRu", () => {
  it("traduce un testo noto", () => {
    expect(traduciRu("Da consegnare oggi")).toBe("Выдать сегодня")
    expect(traduciRu("Crea ordine")).toBe("Создать заказ")
  })

  it("mantiene gli spazi intorno al testo", () => {
    expect(traduciRu("Ref. ")).toBe("Контакт: ")
    expect(traduciRu("  Oggi\n")).toBe("  Сегодня\n")
  })

  it("lascia com'è ciò che non conosce, come nomi e numeri", () => {
    expect(traduciRu("Anna Bellini")).toBe("Anna Bellini")
    expect(traduciRu("333 0000103")).toBe("333 0000103")
    expect(traduciRu("€35.00")).toBe("€35.00")
    expect(traduciRu("")).toBe("")
    expect(traduciRu("   ")).toBe("   ")
  })

  it("scrive le date con i punti", () => {
    expect(traduciRu("15/10/2026")).toBe("15.10.2026")
  })

  it("traduce le date lunghe, con e senza giorno della settimana", () => {
    expect(traduciRu("domenica 11 ottobre")).toBe("воскресенье, 11 октября")
    expect(traduciRu("12 ottobre 2026")).toBe("12 октября 2026")
    expect(traduciRu("Lunedì 3 Marzo")).toBe("понедельник, 3 марта")
  })

  it("non scambia per data un testo qualunque", () => {
    expect(traduciRu("Targa 30 ottobre")).toBe("Targa 30 ottobre")
    expect(traduciRu("Ordini 5 gennaio")).toBe("Ordini 5 gennaio")
  })

  it("traduce 'A:' nell'anteprima del messaggio", () => {
    expect(traduciRu("A: 333 0000103")).toBe("Кому: 333 0000103")
  })

  it("è idempotente: un testo già in russo non cambia", () => {
    for (const russo of Object.values(DIZIONARIO_RU)) expect(traduciRu(russo)).toBe(russo)
    expect(traduciRu("воскресенье, 11 октября")).toBe("воскресенье, 11 октября")
    expect(traduciRu("15.10.2026")).toBe("15.10.2026")
  })

  it("non confonde le proprietà di Object con parole del dizionario", () => {
    expect(traduciRu("constructor")).toBe("constructor")
    expect(traduciRu("toString")).toBe("toString")
  })
})

describe("DIZIONARIO_RU", () => {
  it("ha tutte le traduzioni non vuote e diverse dall'originale", () => {
    for (const [it, ru] of Object.entries(DIZIONARIO_RU)) {
      expect(it.trim().length).toBeGreaterThan(0)
      expect(ru.trim().length).toBeGreaterThan(0)
      expect(ru).not.toBe(it)
    }
  })
})

describe("creaTraduttore", () => {
  it("usa il dizionario e le regole ricevuti", () => {
    const t = creaTraduttore({ Ciao: "Привет" }, REGOLE_RU)
    expect(t("Ciao")).toBe("Привет")
    expect(t("01/02/2026")).toBe("01.02.2026")
  })
})
