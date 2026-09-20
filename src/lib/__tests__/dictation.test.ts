import { appendDictatedText } from "../dictation"

describe("appendDictatedText", () => {
  it("returns the chunk when the current text is empty", () => {
    expect(appendDictatedText("", "ciao mondo")).toBe("ciao mondo")
  })

  it("appends the chunk to existing text with a single space", () => {
    expect(appendDictatedText("Testo esistente", "aggiunta")).toBe("Testo esistente aggiunta")
  })

  it("trims trailing whitespace from the existing text before appending", () => {
    expect(appendDictatedText("Testo esistente   ", "aggiunta")).toBe("Testo esistente aggiunta")
  })

  it("trims the chunk before appending", () => {
    expect(appendDictatedText("Testo esistente", "  aggiunta  ")).toBe("Testo esistente aggiunta")
  })

  it("returns the current text unchanged when the chunk is empty or whitespace-only", () => {
    expect(appendDictatedText("Testo esistente", "")).toBe("Testo esistente")
    expect(appendDictatedText("Testo esistente", "   ")).toBe("Testo esistente")
  })

  it("returns an empty string when both current text and chunk are empty", () => {
    expect(appendDictatedText("", "")).toBe("")
  })
})
