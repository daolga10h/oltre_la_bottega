// Schermate della demo per la presentazione in russo (npm run demo:screenshots).
// Solo dati: lo script scripts/demo-screenshots/run.ts le scatta e ci scrive
// sopra la didascalia. Design: docs/superpowers/specs/2026-10-11-presentazione-russa-design.md

export type SchermataId = "oggi" | "nuovo-ordine" | "bacheca" | "avvisa" | "foglio" | "cliente"

export type Schermata = {
  id: SchermataId
  /** Didascalia in russo, al massimo circa 90 caratteri. */
  didascalia: string
}

export const SCHERMATE_RU: Schermata[] = [
  { id: "oggi", didascalia: "Страница «Oggi»: выдачи, готовые заказы и напоминания — на одном экране" },
  { id: "nuovo-ordine", didascalia: "Новый заказ меньше чем за минуту: данные вернувшегося клиента заполняются сами" },
  { id: "bacheca", didascalia: "«Bacheca»: каждая колонка — этап работы, статус заказа меняется в пару касаний" },
  { id: "avvisa", didascalia: "Готово? Сообщение клиенту уже написано — WhatsApp или e-mail в один клик" },
  { id: "foglio", didascalia: "Рабочий лист для обычного принтера: кладётся вместе с работой" },
  { id: "cliente", didascalia: "Карточка клиента: вся история его заказов перед глазами" },
]
