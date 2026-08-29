import { buildSearchOrClause } from "../search"

describe("buildSearchOrClause", () => {
  it("builds an ilike clause per field, wrapping the term in double quotes", () => {
    expect(buildSearchOrClause("rossi", ["nome", "cognome"])).toBe(
      'nome.ilike."%rossi%",cognome.ilike."%rossi%"'
    )
  })

  it("quotes a term containing a comma so it is treated as one literal value, not split into extra clauses", () => {
    expect(buildSearchOrClause("Rossi, Mario", ["nome"])).toBe(
      'nome.ilike."%Rossi, Mario%"'
    )
  })

  it("escapes double quotes and backslashes inside the term", () => {
    expect(buildSearchOrClause('targa "VIP"', ["nome"])).toBe(
      'nome.ilike."%targa \\"VIP\\"%"'
    )
  })

  it("protects parentheses and periods in the term from PostgREST's .or() grouping syntax", () => {
    expect(buildSearchOrClause("Mario (VIP) sig.ra", ["nome"])).toBe(
      'nome.ilike."%Mario (VIP) sig.ra%"'
    )
  })
})
