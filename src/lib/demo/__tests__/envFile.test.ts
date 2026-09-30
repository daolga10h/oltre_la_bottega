import { parseEnvFile } from "../envFile"

describe("parseEnvFile", () => {
  it("legge coppie CHIAVE=valore", () => {
    expect(parseEnvFile("A=uno\nB=due")).toEqual({ A: "uno", B: "due" })
  })

  it("ignora righe vuote e commenti", () => {
    const testo = "# commento\n\nA=uno\n   # altro commento\nB=due\n"
    expect(parseEnvFile(testo)).toEqual({ A: "uno", B: "due" })
  })

  it("toglie le virgolette intorno al valore", () => {
    expect(parseEnvFile('A="uno"\nB=\'due\'')).toEqual({ A: "uno", B: "due" })
  })

  it("gestisce i file con fine riga di Windows", () => {
    expect(parseEnvFile("A=uno\r\nB=due\r\n")).toEqual({ A: "uno", B: "due" })
  })

  it("usa solo il primo = come separatore (le chiavi finiscono spesso con =)", () => {
    expect(parseEnvFile("KEY=abc==")).toEqual({ KEY: "abc==" })
  })

  it("toglie gli spazi intorno a chiave e valore", () => {
    expect(parseEnvFile("  A  =  uno  ")).toEqual({ A: "uno" })
  })

  it("ignora le righe senza =", () => {
    expect(parseEnvFile("solo testo\nA=uno")).toEqual({ A: "uno" })
  })

  it("un valore vuoto resta una stringa vuota", () => {
    expect(parseEnvFile("A=")).toEqual({ A: "" })
  })

  it("accetta il prefisso export davanti alla chiave", () => {
    expect(parseEnvFile("export A=uno")).toEqual({ A: "uno" })
  })

  it("taglia il commento in coda a un valore senza virgolette", () => {
    expect(parseEnvFile("A=https://x.supabase.co # vero")).toEqual({ A: "https://x.supabase.co" })
  })

  it("taglia il commento in coda a un valore tra virgolette", () => {
    expect(parseEnvFile('A="uno" # c')).toEqual({ A: "uno" })
    expect(parseEnvFile("B='due' # c")).toEqual({ B: "due" })
  })

  it("un # dentro il valore (senza spazio prima) non è un commento", () => {
    expect(parseEnvFile("A=pa#ss")).toEqual({ A: "pa#ss" })
  })

  it("con virgolette non chiuse prende il testo dopo la virgoletta di apertura", () => {
    expect(parseEnvFile('A="uno')).toEqual({ A: "uno" })
  })

  it("ignora il BOM a inizio file", () => {
    expect(parseEnvFile("﻿A=uno")).toEqual({ A: "uno" })
  })
})
