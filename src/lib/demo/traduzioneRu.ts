// Traduzione in russo dei testi dell'app, SOLO per schermate e video della
// presentazione (npm run demo:screenshots, npm run demo:video:ru): l'app resta
// in italiano, gli script sostituiscono i testi nella pagina mentre la
// riprendono. Nomi di persona e numeri non si traducono. Design:
// docs/superpowers/specs/2026-10-11-presentazione-russa-design.md

export type RegolaTraduzione = { da: string; flags: string; a: string }

/**
 * Codice del traduttore in JavaScript semplice: lo stesso testo gira nel
 * browser (iniettato nella pagina) e in Node (test e ricerca degli elementi
 * per nome), così c'è un'unica implementazione. Non usare qui sintassi
 * TypeScript né variabili esterne.
 *
 * Il risultato è idempotente: tradurre un testo già in russo lo lascia com'è.
 */
export const CODICE_TRADUTTORE = String.raw`
function creaTraduttore(dizionario, regole) {
  var MESI = { gennaio: "января", febbraio: "февраля", marzo: "марта", aprile: "апреля", maggio: "мая", giugno: "июня", luglio: "июля", agosto: "августа", settembre: "сентября", ottobre: "октября", novembre: "ноября", dicembre: "декабря" };
  var GIORNI = { "lunedì": "понедельник", "martedì": "вторник", "mercoledì": "среда", "giovedì": "четверг", "venerdì": "пятница", "sabato": "суббота", "domenica": "воскресенье" };
  var compilate = regole.map(function (r) { return [new RegExp(r.da, r.flags), r.a]; });
  var dataLunga = /^(?:([a-zì]+) )?(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/i;
  return function traduci(testo) {
    var parti = /^(\s*)([\s\S]*?)(\s*)$/.exec(testo);
    var nucleo = parti[2];
    if (!nucleo) return testo;
    var esito = null;
    if (Object.prototype.hasOwnProperty.call(dizionario, nucleo)) {
      esito = dizionario[nucleo];
    } else {
      var d = dataLunga.exec(nucleo);
      var mese = d && MESI[d[3].toLowerCase()];
      var giorno = d && d[1] ? GIORNI[d[1].toLowerCase()] : "";
      if (d && mese && (!d[1] || giorno)) {
        esito = (giorno ? giorno + ", " : "") + d[2] + " " + mese + (d[4] ? " " + d[4] : "");
      } else {
        var cambiato = nucleo;
        for (var i = 0; i < compilate.length; i++) cambiato = cambiato.replace(compilate[i][0], compilate[i][1]);
        if (cambiato !== nucleo) esito = cambiato;
      }
    }
    return esito === null ? testo : parti[1] + esito + parti[3];
  };
}
`

export const REGOLE_RU: RegolaTraduzione[] = [
  // 11/10/2026 → 11.10.2026
  { da: "(\\d{2})\\/(\\d{2})\\/(\\d{4})", flags: "g", a: "$1.$2.$3" },
  // anteprima del messaggio: "A: 333 …"
  { da: "^A: ", flags: "", a: "Кому: " },
]

export const DIZIONARIO_RU: Record<string, string> = {
  // menu e intestazioni
  "Principale": "Главное",
  "Oggi": "Сегодня",
  "Bacheca": "Доска",
  "Gestione": "Управление",
  "Agenda": "Планер",
  "Recensioni": "Отзывы",
  "Clienti": "Клиенты",
  "Impostazioni": "Настройки",
  "Cerca ordini, clienti…": "Поиск заказов и клиентов…",
  "Aggiorna": "Обновить",

  // pagina Oggi
  "Nuovo ordine": "Новый заказ",
  "Ordini aperti": "Открытых заказов",
  "In lavorazione": "В работе",
  "In ritardo": "Просрочено",
  "Consegne oggi": "Выдач сегодня",
  "Da consegnare oggi": "Выдать сегодня",
  "Da avvisare": "Нужно оповестить",
  "Consegnati oggi": "Выдано сегодня",
  "Promemoria di oggi": "Напоминания на сегодня",
  "Ref.": "Контакт:",

  // stati e Bacheca
  "Preventivo": "Смета",
  "Da fare": "К выполнению",
  "Pronto": "Готов",
  "Consegnato": "Выдан",
  "Ordini divisi per fase di lavorazione": "Заказы по этапам работы",
  "in attesa": "ждём ответа",
  "da inviare": "отправить",
  "Scheda": "Карточка",
  "Consegna in ritardo": "Выдача просрочена",
  "Consegna oggi": "Выдача сегодня",

  // modulo nuovo ordine
  "Cliente": "Клиент",
  "È un ente/azienda (non una persona)": "Это организация (не частное лицо)",
  "Nome *": "Имя *",
  "Cognome *": "Фамилия *",
  "Azienda": "Организация",
  "Telefono *": "Телефон *",
  "Email": "E-mail",
  "Canale d'ingresso": "Откуда пришёл клиент",
  "negozio": "магазин",
  "Data consegna *": "Дата выдачи *",
  "Consenso recensioni e comunicazioni (GDPR)": "Согласие на отзывы и сообщения (GDPR)",
  "Ordine": "Заказ",
  "Articoli *": "Позиции *",
  "Riga": "Позиция",
  "Quantità": "Количество",
  "Prezzo unitario €": "Цена за единицу, €",
  "Totale:": "Итого:",
  "Non inviare": "Не отправлять",
  "Pagamento": "Оплата",
  "Prezzo € (calcolato)": "Цена, € (расчёт)",
  "Acconto €": "Аванс, €",
  "Saldo €": "Остаток, €",
  "Note": "Заметки",
  "Crea ordine": "Создать заказ",
  "Annulla": "Отмена",
  "Nome": "Имя",
  "Cognome": "Фамилия",
  "Associazione, azienda... (facoltativo)": "Ассоциация, компания…",
  "Es. targa plexiglass, timbro, portachiavi inciso...": "Напр. табличка из оргстекла, печать, гравированный брелок…",
  "Testo da scrivere / incidere / stampare": "Текст для надписи / гравировки / печати",
  "Avvia dettatura": "Начать диктовку",
  "Note interne": "Внутренние заметки",

  // scheda ordine
  "Foglio lavoro": "Рабочий лист",
  "Modifica": "Изменить",
  "Consegna prevista": "Плановая выдача",
  "Avvisa il cliente:": "Сообщить клиенту:",
  "Articoli": "Позиции",
  "Prezzo (calcolato)": "Цена (расчёт)",
  "Acconto": "Аванс",
  "Saldo": "Остаток",
  "Segna come pagato": "Отметить как оплаченный",
  "Attività": "История",
  "Ordine creato": "Заказ создан",
  "Buongiorno, l'ordine è pronto per il ritiro": "Добрый день, ваш заказ готов к выдаче",
  "Msg PRONTO": "Сообщение «Готов» отправлено",
  "Recensione da chiedere": "Попросить отзыв",
  "Recensione richiesta": "Отзыв запрошен",
  "Recensione ricevuta": "Отзыв получен",
  'Messaggio "pronto per il ritiro" inviato': "Сообщение «готов к выдаче» отправлено",
  "Pagamento saldato": "Оплата получена",
  "Preventivo da inviare": "Смету нужно отправить",
  "Preventivo inviato al cliente": "Смета отправлена клиенту",
  "Pronto per la consegna": "Готов к выдаче",
  "Consegnato al cliente": "Выдан клиенту",

  // foglio lavoro
  "Consegnare:": "Выдать:",
  "Da pagare: €": "К оплате: €",
  "Scansiona per aprire la scheda": "Сканируйте, чтобы открыть карточку",

  // rubrica e profilo cliente
  "Cerca": "Найти",
  "Telefono": "Телефон",
  "Ordini": "Заказы",
  "Ultimo ordine": "Последний заказ",
  "consenso": "согласие",
  "Cerca per nome o telefono…": "Поиск по имени или телефону…",
  "Ordini totali": "Всего заказов",
  "Totale speso": "Потрачено всего",
  "Storico ordini": "История заказов",
  "Consegna:": "Выдача:",

  // promemoria
  "Pagare la bolletta della luce": "Оплатить счёт за электричество",
  "Ordinare il cartoncino dal fornitore": "Заказать картон у поставщика",
  "Richiamare Anna Bellini: ordine pronto": "Перезвонить Anna Bellini: заказ готов",

  // dati della demo: lavori
  "Targa in plexiglass 30x10": "Табличка из оргстекла 30×10",
  "Targa in plexiglass 30×10": "Табличка из оргстекла 30×10",
  "Targhe portamatricola": "Рамки для номерных знаков",
  "Portachiavi inciso": "Гравированный брелок",
  "Coppa premiazione": "Кубок для награждения",
  "Targhette tavoli numerate": "Номерки на столы",
  "Timbro automatico": "Автоматическая печать",
  "Coppe e medaglie": "Кубки и медали",
  "Insegna per negozio": "Вывеска для магазина",
  "Bomboniere incise": "Гравированные бонбоньерки",
  "Targa in ottone": "Латунная табличка",
  "Timbro con logo": "Печать с логотипом",
  "Timbro medico": "Врачебная печать",
  "Quadro inciso su legno": "Картина, выгравированная на дереве",
  "Magliette personalizzate": "Футболки с принтом",
  "Chiavi e targhetta": "Ключи и бирка",
  "Targa studio": "Табличка для кабинета",
  "Trofeo torneo": "Кубок турнира",
  "Targa per condominio": "Табличка для дома",
  "Famiglia Bellini": "Семья Bellini",

  // dati della demo: organizzazioni
  "Officina Bianchi": "Автомастерская Bianchi",
  "Trattoria Da Rosa": "Траттория «Da Rosa»",
  "Associazione Il Faro": "Ассоциация «Il Faro»",
}

export type Traduttore = (testo: string) => string

/** Stesso traduttore che gira nel browser, usabile in Node (test, ricerca per nome). */
export const creaTraduttore = new Function(`${CODICE_TRADUTTORE}; return creaTraduttore;`)() as (
  dizionario: Record<string, string>,
  regole: RegolaTraduzione[]
) => Traduttore

/** Traduce un testo italiano dell'app in russo; ciò che non conosce resta com'è. */
export const traduciRu: Traduttore = creaTraduttore(DIZIONARIO_RU, REGOLE_RU)
