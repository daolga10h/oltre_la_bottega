# Niente recensione per ordini ente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the "Chiedere recensione" / "Recensione richiesta" / "Recensione ricevuta" toggles from the order form when the order is an entity (`is_ente: true`), and force those three fields to `false` on save regardless of stale UI state.

**Architecture:** Single-file change in `OrderForm.tsx` — filter the review-pipeline toggles out of the existing flags array when `isEnte` is true, and force the three corresponding payload fields to `false` when `isEnte` is true. No schema change, no other files touched (the Recensioni page and order-detail flag pills already stay empty automatically once these fields are always `false` for an ente order).

**Tech Stack:** Next.js App Router, TypeScript.

**Full design reference:** `docs/superpowers/specs/2026-09-10-niente-recensione-enti-design.md`

---

### Task 1: `OrderForm.tsx` — hide review toggles and force-null the payload for enti

**Files:**
- Modify: `src/components/OrderForm.tsx`

No component test infrastructure exists in this codebase (same convention already used for the rest of `OrderForm.tsx`) — verified via `tsc` and the manual check in Task 2.

- [ ] **Step 1: Force the three review fields to `false` in the submit payload when `isEnte`**

Replace this block in the `payload` object inside `handleSubmit`:

```typescript
      consenso_marketing: consensoMarketing,
      chiedere_recensione: chiedereRec,
      recensione_richiesta: recRichiesta,
      recensione_ricevuta: recRicevuta,
      msg_pronto_inviato: msgPronto,
```

with:

```typescript
      consenso_marketing: consensoMarketing,
      chiedere_recensione: isEnte ? false : chiedereRec,
      recensione_richiesta: isEnte ? false : recRichiesta,
      recensione_ricevuta: isEnte ? false : recRicevuta,
      msg_pronto_inviato: msgPronto,
```

- [ ] **Step 2: Hide the three review toggles from the flags grid when `isEnte`**

Replace this block (the "NOTE + FLAG" section's flags grid):

```typescript
        {isEdit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Msg PRONTO inviato", state: msgPronto, set: setMsgPronto },
              { label: "Chiedere recensione", state: chiedereRec, set: setChiedereRec },
              { label: "Recensione richiesta", state: recRichiesta, set: setRecRichiesta },
              { label: "Recensione ricevuta", state: recRicevuta, set: setRecRicevuta },
            ].map(({ label, state, set }) => (
```

with:

```typescript
        {isEdit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Msg PRONTO inviato", state: msgPronto, set: setMsgPronto },
              ...(isEnte ? [] : [
                { label: "Chiedere recensione", state: chiedereRec, set: setChiedereRec },
                { label: "Recensione richiesta", state: recRichiesta, set: setRecRichiesta },
                { label: "Recensione ricevuta", state: recRicevuta, set: setRecRicevuta },
              ]),
            ].map(({ label, state, set }) => (
```

- [ ] **Step 3: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors referencing `OrderForm.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat: hide review toggles and force them false for ordini ente"
```

---

### Task 2: Verification and CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full unit test suite**

Run: `npx jest --roots=src`
Expected: PASS, all suites green, same count as before this change (this task doesn't add or touch any test files).

- [ ] **Step 2: Run the type checker on the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual golden-path check in the dev server**

Run: `npm run dev`, then in the browser:
1. Create a new ente order (check "È un ente/azienda", fill Nome ente/azienda, Telefono, Data consegna, Operatore, one articolo) and save it.
2. Click "Modifica" — confirm the flags row shows only "Msg PRONTO inviato" (no "Chiedere recensione" / "Recensione richiesta" / "Recensione ricevuta").
3. Save without changing anything — confirm the order still saves fine.
4. Go to `/recensioni` — confirm this order does NOT appear there.
5. Create a normal private order (no "È un ente/azienda") and edit it — confirm all four flags still appear as before, and that toggling "Chiedere recensione" on and saving still shows the order in `/recensioni` after marking it "Consegnato" (regression check — this flow already existed, just confirming it's untouched).
6. Edge case: create a private order, edit it, toggle "Chiedere recensione" ON, then in the same edit session check "È un ente/azienda" and save — confirm the saved order has `chiedere_recensione: false` (visible as: the flags pills on the order detail page show no "Recensione da chiedere" pill, and the order does not appear in `/recensioni`).
7. Stop the dev server (Ctrl+C).

- [ ] **Step 4: Update CLAUDE.md**

Add this row to the "Decisioni chiave e motivazioni" table, after the row about "Clienti ente/azienda con referente" (the last row in the table):

```markdown
| Niente pipeline recensione per gli ordini ente (2026-09-10) | Un ente/azienda non lascia una recensione Google personale come farebbe un cliente privato — i tre toggle "Chiedere recensione"/"Recensione richiesta"/"Recensione ricevuta" (sezione Note del form, solo in modifica) non compaiono quando `is_ente` è true, e i tre campi corrispondenti vengono forzati a `false` al salvataggio indipendentemente dallo state React residuo — stesso meccanismo già usato per azzerare Cognome/Azienda quando si attiva "È un ente" (vedere riga "Clienti ente/azienda con referente"). Nessuna migration: la pagina Recensioni e i pallini riepilogativi in scheda ordine restano invariati, dato che un campo sempre `false` non vi compare mai, senza bisogno di un filtro `is_ente` separato. "Msg PRONTO inviato" e il consenso marketing (GDPR) restano invariati e disponibili per qualunque cliente, ente incluso — non fanno parte della pipeline recensione |
```

Then add a new bullet to the Testing section, after the "Feature (2026-09-09/10): clienti ente/azienda con referente" bullet:

```markdown
- **Feature (2026-09-10)**: niente pipeline recensione per gli ordini ente — vedere riga corrispondente in Decisioni chiave. Modifica di una riga in `OrderForm.tsx`: i tre toggle "Chiedere recensione"/"Recensione richiesta"/"Recensione ricevuta" (sezione Note, solo in modifica) sono esclusi dalla lista quando `isEnte` è true, e i tre campi corrispondenti nel payload di salvataggio sono forzati a `false` quando `isEnte` è true. Nessuna migration, nessun nuovo test automatico (nessuna infrastruttura di test per componenti in questo codebase) — verificato manualmente nel browser: toggle assenti in modifica di un ordine ente, comportamento invariato per un ordine privato, e un ordine privato con "Chiedere recensione" già attivo convertito in ente durante la modifica salva correttamente `false`. Design in `docs/superpowers/specs/2026-09-10-niente-recensione-enti-design.md`, piano in `docs/superpowers/plans/2026-09-10-niente-recensione-enti-plan.md`.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document niente recensione per ordini ente in CLAUDE.md"
```
