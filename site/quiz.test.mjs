// Test di quiz-data.js. Esecuzione: node --test site/quiz.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sandbox = {};
new Function("window", readFileSync(join(root, "quiz-data.js"), "utf8"))(sandbox);
const Q = sandbox.QUIZ;

test("7 domande, ciascuna con 3 risposte", () => {
  assert.equal(Q.domande.length, 7);
  for (const d of Q.domande) {
    assert.ok(d.testo.length > 0);
    assert.equal(d.risposte.length, 3);
  }
});

test("i profili coprono ogni punteggio da 0 a 14, senza buchi né sovrapposizioni", () => {
  for (let p = 0; p <= 14; p++) {
    const trovati = Q.profili.filter((x) => p >= x.da && p <= x.a);
    assert.equal(trovati.length, 1, "punteggio " + p);
  }
});

test("calcolaPunteggio somma le risposte", () => {
  assert.equal(Q.calcolaPunteggio([0, 0, 0, 0, 0, 0, 0]), 0);
  assert.equal(Q.calcolaPunteggio([2, 2, 2, 2, 2, 2, 2]), 14);
  assert.equal(Q.calcolaPunteggio([1, 0, 2, 1, 0, 2, 1]), 7);
});

test("calcolaPunteggio rifiuta risposte incomplete o non valide", () => {
  assert.throws(() => Q.calcolaPunteggio([0, 0, 0]));
  assert.throws(() => Q.calcolaPunteggio([0, 0, 0, 0, 0, 0, 3]));
  assert.throws(() => Q.calcolaPunteggio([0, 0, 0, 0, 0, 0, "1"]));
});

test("profiloPer sceglie il profilo giusto ai confini", () => {
  assert.equal(Q.profiloPer(0).id, "ordine");
  assert.equal(Q.profiloPer(4).id, "ordine");
  assert.equal(Q.profiloPer(5).id, "buchi");
  assert.equal(Q.profiloPer(9).id, "buchi");
  assert.equal(Q.profiloPer(10).id, "spalle");
  assert.equal(Q.profiloPer(14).id, "spalle");
  assert.throws(() => Q.profiloPer(15));
  assert.throws(() => Q.profiloPer(-1));
});

test("ogni regalo punta a una pagina che esiste", () => {
  for (const p of Q.profili) {
    const file = p.regalo.href.replace(/^\//, "") + ".html";
    assert.ok(existsSync(join(root, file)), p.id + ": manca site/" + file);
  }
});

test("solo il profilo più organizzato riceve il modulo", () => {
  const conModulo = Q.profili.filter((p) => p.regalo.href === "/modulo").map((p) => p.id);
  assert.deepEqual(conModulo, ["ordine"]);
});
