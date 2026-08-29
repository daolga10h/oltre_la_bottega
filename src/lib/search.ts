/**
 * Costruisce la parte destra di una `.or()` PostgREST che cerca `term` (case
 * insensitive, sottostringa) su più colonne. PostgREST usa "," e "()" come
 * delimitatori dentro `.or()`, quindi il termine va racchiuso tra doppi apici
 * (con backslash/apici interni escapati) per essere trattato come valore letterale.
 */
export function buildSearchOrClause(term: string, fields: string[]): string {
  const escaped = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const quoted = `"%${escaped}%"`
  return fields.map((field) => `${field}.ilike.${quoted}`).join(",")
}
