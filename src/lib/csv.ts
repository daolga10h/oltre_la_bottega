import { STATUS_LABELS } from "@/lib/orderConstants"

export type OrderExportRow = {
  nome: string
  cognome: string | null
  telefono: string | null
  email_cliente: string | null
  cosa_ordinato: string
  data_ordine: string | null
  data_consegna: string | null
  data_consegnato: string | null
  status: string
  operatore: string | null
  prezzo: number
  acconto: number
  saldo: number
  note: string | null
}

const HEADERS = [
  "Nome",
  "Cognome",
  "Telefono",
  "Email",
  "Cosa ordinato",
  "Data ordine",
  "Data consegna",
  "Data consegnato",
  "Stato",
  "Operatore",
  "Prezzo",
  "Acconto",
  "Saldo",
  "Note",
]

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function rowToCsvLine(values: (string | number | null)[]): string {
  return values.map((v) => escapeCsvField(v === null ? "" : String(v))).join(",")
}

export function ordersToCsv(orders: OrderExportRow[]): string {
  const lines = [rowToCsvLine(HEADERS)]
  for (const order of orders) {
    lines.push(
      rowToCsvLine([
        order.nome,
        order.cognome,
        order.telefono,
        order.email_cliente,
        order.cosa_ordinato,
        order.data_ordine,
        order.data_consegna,
        order.data_consegnato,
        STATUS_LABELS[order.status] ?? order.status,
        order.operatore,
        order.prezzo,
        order.acconto,
        order.saldo,
        order.note,
      ])
    )
  }
  return lines.join("\r\n")
}