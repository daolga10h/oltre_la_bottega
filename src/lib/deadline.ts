export type DeadlineLevel = "domani" | "oggi" | "ritardo"

export const DEADLINE_LABELS: Record<DeadlineLevel, string> = {
  domani: "Consegna domani",
  oggi: "Consegna oggi",
  ritardo: "Consegna in ritardo",
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Il server gira in UTC: calcolare "oggi" sul suo fuso sbaglierebbe giorno tra
// mezzanotte e l'una/due di notte italiane, quindi si usa sempre il giorno di Roma.
function romeDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number)
  const [ty, tm, td] = toIso.split("-").map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY)
}

export function deadlineLevel(
  dataConsegna: string | null | undefined,
  status: string,
  now: Date = new Date()
): DeadlineLevel | null {
  if (!dataConsegna || status === "consegnato") return null

  const diff = daysBetween(romeDate(now), dataConsegna.slice(0, 10))
  if (diff < 0) return "ritardo"
  if (status === "pronto") return null
  if (diff === 0) return "oggi"
  if (diff === 1) return "domani"
  return null
}
