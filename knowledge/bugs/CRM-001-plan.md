# CRM-001 — Fix Implementation Plan

| Field | Value |
|---|---|
| Bug ID | CRM-001 |
| Plan author | Atlas Fix Planner |
| Date | 2026-07-06 |
| Reference | `knowledge/bugs/CRM-001.md` |
| Status | **PLAN — awaiting implementation approval** |
| Code written | None (planning only) |

---

## 0. Goal

Stop the Customers list Edit dialog from silently wiping `altPhone`, `address`, `notes`, `isRepeat`. Make the form pre-populate from the row, and make the server write only what the user actually changed.

Non-goal: redesigning the Edit dialog, adding new fields, or touching any other module.

---

## 1. Affected Files — Surgical Change Spec

Six files. Four require code changes. Two require re-test only (no edits).

### File 1 — `src/lib/services/customers.ts`  (CHANGE)

**Why it must change**
`CustomerRow` (`:4-16`) and `getCustomers`'s `select` (`:51-61`) omit the four wiped fields, so the client can never pre-populate them. `toRow` (`:93-107`) must also map the new fields or the row passed back to the client after an update will drop them again.

**What exactly will change**
1. `CustomerRow` interface — add four fields:
   - `altPhone: string | null;`
   - `address: string | null;`
   - `notes: string | null;`
   - `isRepeat: boolean;`
2. `getCustomers` `select` — add `altPhone: true, address: true, notes: true, isRepeat: true` to the existing `select` object.
3. `toRow` — map `altPhone: customer.altPhone ?? null`, `address: customer.address ?? null`, `notes: customer.notes ?? null`, `isRepeat: customer.isRepeat`.
4. `getCustomers` return map (`:76-90`) — include the four fields in the returned object so the list page's `initialCustomers` carries them.

**Expected impact**
- `CustomerRow` gains four fields. All existing consumers receive extra data (non-breaking).
- The list query fetches four more columns from rows already in memory on the DB side — negligible cost.
- `getCustomerById` / `CustomerProfileData` are untouched (separate type, already has the fields).

**Risk**
Low. Type widening is additive. No Prisma migration. No schema change.

**Rollback strategy**
Revert the single file. No data migration to undo because no data has been moved — the columns already existed.

**Verification steps**
1. `npx tsc --noEmit` — typecheck passes.
2. `npm run lint` — no new warnings.
3. Manual: open `/customers`, inspect a network/response or React DevTools state — a row whose DB `altPhone`/`address`/`notes`/`isRepeat` are populated now carries those values on `initialCustomers`.
4. Confirm `getCustomerById` (profile page) still returns the same shape it did before — untouched.

---

### File 2 — `src/app/(dashboard)/customers/customers-client.tsx`  (CHANGE)

**Why it must change**
`openEdit` (`:150-164`) hard-codes `altPhone: ""`, `address: ""`, `notes: ""`, `isRepeat: false` because the old `CustomerRow` lacked those fields. Once File 1 is fixed, `openEdit` must read from the row. Optionally, `onSubmit` (`:174-211`) should send only dirty fields so the server cannot overwrite fields the user never touched.

**What exactly will change**
1. `openEdit` — replace the four hard-coded values with row reads:
   - `altPhone: customer.altPhone ?? ""`
   - `address: customer.address ?? ""`
   - `notes: customer.notes ?? ""`
   - `isRepeat: customer.isRepeat`
2. (Hardening, recommended) `onSubmit` — build a partial payload using `formState.dirtyFields` instead of submitting the whole `formData`. Skip unchanged fields entirely. For the update path, send only `{ id, ...dirtyFields }`.
3. The Edit dialog inputs (`:529-602`) need no structural change — they already bind via `register`/`watch`/`setValue`; pre-population will now reflect real values.

**Expected impact**
- Edit dialog opens with real values for the four fields.
- Save sends only what the user changed (if hardening is applied) — server writes only dirty fields.
- Create path (`openCreate`, `:134-148`) is untouched — still resets to defaults.

**Risk**
Medium. The dirty-fields refactor is the riskier part; the `openEdit` change is trivial. If the dirty-fields approach is skipped, the bug is still fixed by File 1 + File 2 step 1 alone (because the form now holds the real values, so re-saving them is a no-op write).

**Rollback strategy**
Revert the file. The `openEdit` change is isolated; the `onSubmit` change is isolated. They can be reverted independently.

**Verification steps**
1. `npx tsc --noEmit`.
2. `npm run lint`.
3. Manual (the core UAT Case 18): seed a customer with `altPhone`, `address`, `notes` non-empty and `isRepeat = true`. Click Edit → inputs show the real values, checkbox checked. Click Save without touching them. Reload. Values persist.
4. Manual: change only `name` in Edit, save. Confirm `altPhone`/`address`/`notes`/`isRepeat` are unchanged in DB (dirty-fields path) or unchanged in effect (full-payload path, because they were re-sent with the same values).
5. Create flow regression: click "New Customer", fill required fields, save — still works, toast appears.

---

### File 3 — `src/app/(dashboard)/customers/actions.ts`  (CHANGE — optional, only if dirty-fields hardening is applied)

**Why it must change**
If File 2 step 2 (dirty-fields payload) is applied, `updateSchema` (`:22-33`) is already permissive (`optional()` everywhere) and needs no change. If the team chooses to keep the full-payload approach, no change is required here at all.

**What exactly will change**
- **No change required for the minimum fix.** `updateSchema` already accepts partial input.
- (Optional hardening) If we want server-side defense in depth, add a guard: if `altPhone === "" && address === "" && notes === "" && isRepeat === false` simultaneously, log a `console.warn` (not a block — this pattern is valid in edge cases). This is advisory only.

**Expected impact**
None for the minimum fix. The server was already correct for partial input — the bug was that the client sent wrong values, not that the server mis-validated.

**Risk**
Low / None. The minimum fix does not touch this file.

**Rollback strategy**
N/A for the minimum fix.

**Verification steps**
1. `npx tsc --noEmit` (only if the optional guard is added).
2. Manual: update a customer, confirm `updateCustomerAction` returns `{ success: true, data }` and the row updates.

---

### File 4 — `src/lib/services/customers.ts` `updateCustomer`  (CHANGE — optional hardening only)

**Why it must change**
With File 1 + File 2 step 1, `updateCustomer` (`:146-181`) is correct: it writes whatever it receives, and the client now sends the right values. No change required for the minimum fix.

**What exactly will change**
- **No change for the minimum fix.**
- (Optional hardening) Treat `""` for optional string fields as "no change" when the caller is on the update path. This is **not recommended** — it would break the legitimate case where a user intentionally clears a field. Skip it.

**Expected impact**
None.

**Risk**
None for the minimum fix. The optional hardening is explicitly **not** recommended because it would prevent users from intentionally clearing a field.

**Rollback strategy**
N/A.

**Verification steps**
1. Existing behavior: an update that sends `altPhone: "new value"` writes `"new value"`; an update that sends `altPhone: ""` writes `NULL` (intentional clear). Both are correct.

---

### File 5 — `src/app/(dashboard)/customers/page.tsx`  (NO CHANGE — re-test only)

**Why it appears in scope**
It passes `initialCustomers` from `getCustomers` to `CustomersClient`. After File 1, that prop carries four extra fields.

**What exactly will change**
Nothing. It forwards the result of `getCustomers`.

**Expected impact**
None — prop forwarding.

**Risk**
None.

**Rollback strategy**
N/A.

**Verification steps**
1. Page renders without error.
2. `initialCustomers` passed to `CustomersClient` has the four new fields (verify via DevTools or a `console.log` in a scratch build — remove before merge).

---

### File 6 — `prisma/schema.prisma`  (NO CHANGE — re-verify only)

**Why it appears in scope**
It defines the `Customer` fields being wiped. The plan touches the query, not the schema.

**What exactly will change**
Nothing. No migration. The columns `altPhone`, `address`, `notes`, `isRepeat` already exist (`:41`, `:44`, `:45`, `:48`).

**Expected impact**
None.

**Risk**
None — no migration means no deployment risk, no data movement, no downtime.

**Rollback strategy**
N/A.

**Verification steps**
1. `npx prisma validate` — schema still valid.
2. Confirm no new migration was generated (`prisma/migrations/` unchanged).

---

## 2. Implementation Order

Strictly sequential. Each step builds on the previous.

| Step | File | Change | Depends on |
|---|---|---|---|
| 1 | `src/lib/services/customers.ts` | Extend `CustomerRow`, `getCustomers` select, return map, `toRow` with the four fields | — |
| 2 | `src/app/(dashboard)/customers/customers-client.tsx` | Fix `openEdit` to pre-populate from the row | Step 1 (needs the new `CustomerRow` fields to typecheck) |
| 3 | (Optional) `src/app/(dashboard)/customers/customers-client.tsx` `onSubmit` | Build a dirty-fields payload instead of submitting the whole form | Step 2 |
| 4 | Typecheck + lint + manual reproduction | — | Steps 1–2 (or 1–3 if hardening applied) |
| 5 | Regression test pass (see §4) | — | Step 4 |

**Note on Step 3:** It is recommended but not required to fix the bug. If the team prefers the minimum fix, skip Step 3 — the bug is still gone because the form holds the real values, so re-saving them is a no-op. Step 3 is worth doing in the same PR only if the team wants defense in depth against future "form reset" class bugs.

---

## 3. Estimated Time

| Step | Effort |
|---|---|
| Step 1 (services/customers.ts) | 10 min |
| Step 2 (openEdit) | 5 min |
| Step 3 (dirty-fields onSubmit, optional) | 25 min |
| Typecheck + lint | 5 min |
| Manual reproduction (UAT Case 18) | 10 min |
| Regression test pass (§4) | 30 min |
| **Total (minimum fix)** | **~60 min** |
| **Total (with hardening)** | **~85 min** |

Estimates assume a single developer on a local dev server with the DB seeded. No CI wait, no migration, no deploy.

---

## 4. Regression Test Plan

### 4.1 Automated (if any exist)
1. Run `npm run test` (or project equivalent — check `package.json` scripts). Confirm no existing test breaks.
2. Run `npx tsc --noEmit`. Must pass.
3. Run `npm run lint`. Must pass with no new warnings.
4. If there are snapshot tests on `CustomerRow` or the Customers list, they will need updating (the four new fields). Update snapshots — do not blindly accept; diff first.

### 4.2 Manual — CRM (must pass)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| R1 | Edit preserves populated optional fields (UAT Case 18) | Seed customer with `altPhone`, `address`, `notes` non-empty and `isRepeat=true`. Edit → Save without touching those fields. Reload. | All four values preserved in DB and on profile page. |
| R2 | Edit preserves empty optional fields | Seed customer with all four empty/false. Edit → Save. Reload. | Still empty/false. No error. |
| R3 | Edit intentionally clears a field | Edit a customer, delete the `altPhone` value, save. Reload. | `altPhone` is NULL in DB, profile shows "—". |
| R4 | Edit toggles isRepeat | Edit, check `isRepeat`, save. Reload. | `isRepeat` is true. |
| R5 | Edit changes only name | Edit, change only `name`, save. | Other fields unchanged. (With Step 3 hardening: only `name` in audit `changes`. Without: all four listed but values are no-ops.) |
| R6 | Create still works | "New Customer" → fill required → save. | Row appears, toast shown, fields saved. |
| R7 | Create then immediate Edit | Create a customer, then immediately Edit it. | Edit shows the values you just entered. |
| R8 | Permissions — VIEWER cannot edit | Log in as VIEWER. | No Edit button column. |
| R9 | Permissions — SALES_REP edit | Log in as SALES_REP. Edit a customer you own. | Save works; `ownerId` not changeable (stripped server-side). |
| R10 | Search / filter / pagination still work | Use search box, type/source/stage/owner filters, next/prev page. | Behavior unchanged. |
| R11 | Row click → profile | Click the customer name link. | Navigates to `/customers/[id]` with all fields populated. |

### 4.3 Manual — Adjacent dialogs (must pass — they share `updateCustomer`)

| # | Scenario | Expected |
|---|---|---|
| R12 | Assign Owner dialog (`/customers/[id]`) | Assigning an owner updates `ownerId` only; does NOT wipe `altPhone`/`address`/`notes`/`isRepeat`. |
| R13 | Set Coverage dialog | Updates `coveredById` only; does NOT wipe the four fields. |
| R14 | Stage Change dialog | Updates `stage` (+ `rejectReason`) only; does NOT wipe the four fields. |

### 4.4 Manual — Profile page (must pass)

| # | Scenario | Expected |
|---|---|---|
| R15 | Profile renders | `/customers/[id]` shows all fields including `altPhone`, `address`, `notes`, `isRepeat` correctly. |
| R16 | Profile after edit | After R1, the profile shows the preserved values, not "—". |

### 4.5 DB / audit verification

| # | Scenario | Expected |
|---|---|---|
| R17 | Direct DB check after R1 | `SELECT altPhone, address, notes, isRepeat FROM Customer WHERE id=…` returns the original values. |
| R18 | ActivityLog after R1 | Latest `CUSTOMER_UPDATED` row's `details.changes` lists only the fields the user actually changed (with Step 3) or lists the four fields but with no real value change (without Step 3). No false-positive "wipe" entry. |

---

## 5. Definition of Done

All of the following must be true:

1. **Code**
   - [ ] `CustomerRow` includes `altPhone`, `address`, `notes`, `isRepeat`.
   - [ ] `getCustomers` select returns those four fields.
   - [ ] `toRow` maps those four fields.
   - [ ] `openEdit` pre-populates the form from the row (no hard-coded `""`/`false`).
   - [ ] (Optional) `onSubmit` sends only dirty fields on the update path.
2. **Verification gates**
   - [ ] `npx tsc --noEmit` passes.
   - [ ] `npm run lint` passes with no new warnings.
   - [ ] `npm run test` (if present) passes; snapshots updated with a reviewed diff.
   - [ ] `npx prisma validate` passes; no new migration generated.
3. **Manual UAT**
   - [ ] R1 (UAT Case 18) passes — the bug is fixed.
   - [ ] R2–R16 pass.
   - [ ] R17 (direct DB check) confirms preservation.
   - [ ] R18 (audit log) shows no false-positive wipe entry.
4. **Scope discipline**
   - [ ] No schema migration.
   - [ ] No changes to `prisma/schema.prisma`.
   - [ ] No changes to other modules (quotations, inspections, etc.).
   - [ ] No changes to `getCustomerById` / `CustomerProfileData`.
   - [ ] No new dependencies.
5. **Documentation**
   - [ ] `knowledge/bugs/CRM-001.md` "Status" line updated from "Investigated" to "Fixed" (with commit/PR reference) — **after** the fix lands, not in this plan.
   - [ ] `knowledge/uat/customers.md` UAT Case 18 marked PASS — **after** verification.

---

## 6. Out of Scope (explicitly)

- Redesigning the Edit dialog UI.
- Adding new Customer fields.
- Touching the Create path beyond confirming it still works.
- Touching the profile page (`/customers/[id]`) beyond confirming it still renders.
- Other CRM cosmetic bugs noted in `knowledge/uat/customers.md` (raw enum labels, missing success toasts on dialogs, etc.).
- Any other module.
- Any DB migration.

---

## 7. Stop

Plan complete. **No code written. Awaiting implementation approval.**
