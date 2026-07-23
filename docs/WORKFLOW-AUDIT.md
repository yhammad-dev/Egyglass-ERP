# EgyGlass ERP — End-to-End Workflow Audit (18 Steps)

> **Read-only audit. No code was modified.** Every claim below cites `file:line`.
> **Audited state:** branch `master`, HEAD `75d3a0e` ("B2 (BL-113/D-41): REVIEW manufacturing screen…"),
> identical to `master`, 0 ahead / 0 behind. This is exactly the reference commit.
> **Method:** `requireRole` in `src/lib/rbac.ts` is a flat exact-match allowlist (line 24) —
> the `roleHierarchy` map (line 3) is **not** consulted. A step is **BUILT** only when a server
> action performs the transition *and* carries a role gate; **PARTIAL** when it exists but a
> sub-requirement is missing; **MISSING** when there is no code.

---

## Legend

- **BUILT** — server action exists + role gate found + transition actually performed.
- **PARTIAL** — action exists but a claimed sub-requirement is unimplemented.
- **MISSING** — no code performs the step.
- An enum value or a UI dropdown is **not** evidence of a wired transition — only a server action counts.

---

## Full audit table

| # | Step (claimed role) | Actual enforced role (file:line) | Action / function (file:line) | Verdict | Discrepancy |
|---|---|---|---|---|---|
| 1 | Request intake — customer inquiry / quote request (customer/entry point) | `ADMIN, SALES_MANAGER, SALES_REP` — `src/app/(dashboard)/customers/actions.ts:39` via requireRole `:101` | `createQuotationRequestAction` `src/app/(dashboard)/customers/actions.ts:100` → `createQuotationRequest` `src/lib/services/quotation-requests.ts:19` | **BUILT** | No customer-facing/public intake. Entry is internal: a sales user creates a `QuotationRequest` from the customer file. "Customer inquiry" is never captured by a customer. |
| 2 | Sales distribution — register + assign to reps (SALES_MANAGER) | register: `ADMIN, SALES_MANAGER, SALES_REP` `customers/actions.ts:39`; assign: `ADMIN, SALES_MANAGER` `src/lib/actions/customers.ts:110` | register `createCustomerAction` `customers/actions.ts:41`; assign `assignCustomer` `src/lib/actions/customers.ts:107`; coverage `setCustomerCoverage` `src/lib/actions/customers.ts:155` | **BUILT** | Dedicated distribution (`assignCustomer`) is manager-only. But `ownerId` is also writable by a `SALES_REP` via `createCustomer`/`updateCustomer` (`src/lib/services/customers.ts:143`, `:182`) → a rep can self-assign, sidestepping the manager-only gate (SoD gap). |
| 3 | Inspection — site visit + measurements + photos (INSPECTION_MANAGER) | create: `SALES_REP, SALES_MANAGER, ADMIN` `inspections/actions.ts:42`; schedule/approve: `ADMIN, INSPECTION_MANAGER` `:39`; measure/photos: `ADMIN, INSPECTION_MANAGER, INSPECTION_REP` `:38` + ownership `:52` | `createInspectionAction` `:87`; `scheduleInspectionAction` `:61`; `addMeasurementAction` `:206`; `addInspectionAttachment` `:326`; `approveInspection` `:569` (all `src/app/(dashboard)/inspections/actions.ts`) | **BUILT** | Claimed single role is wrong. Per D-37: manager schedules/assigns + approves but does **not** create; SALES creates; the site-visit measurements + photos are recorded by **INSPECTION_REP** (ownership-guarded). Split across 3 role groups. |
| 4 | Technical office — receive request + address procurement (TEC_APPROVER?) | queue: `ADMIN, TECHNICAL_OFFICE, TEC_APPROVER` `technical-office/actions.ts:15`; assign engineer: `ADMIN, TEC_APPROVER` `:16` | `getTecJobsAction` `:18`; `assignEngineerAction` `:89` (both `src/app/(dashboard)/technical-office/actions.ts`) | **PARTIAL** | "Receive request + assign engineer" BUILT (TEC_APPROVER assigns — matches). **"Address procurement" MISSING**: no code routes a request to procurement for a cost report before pricing (see step 5). |
| 5 | Warehouse/Procurement — materials/availability/make-buy/cost (PROCUREMENT) | — (no such action) | none found | **MISSING** | No warehouse/availability/make-vs-buy/cost-report module. `Material` is an admin-maintained pricing cost catalog (`lib/pricing/actions.ts:65`), not a procurement step. All `PROCUREMENT` gates are post-approval (factories `factories/actions.ts:13`; factory assign `manufacturing/[id]/actions.ts:24`; mfg list `manufacturing/actions.ts:16`). |
| 6 | Pricing — price the design from the cost report (TECHNICAL_OFFICE) | `ADMIN, SALES_MANAGER, TECHNICAL_OFFICE, TEC_APPROVER` `lib/pricing/actions.ts:18` via requireRole `:291` | `createQuotation` `lib/pricing/actions.ts:287`; `updateQuotation` `:478` | **BUILT** | TECHNICAL_OFFICE gated (matches); `SALES_REP` correctly excluded (W-01). Pricing derives from the **Material recipe catalog** (`calculateRecipe`), not a procurement cost report (which does not exist — step 5). |
| 7 | Review — triple match: drawing + customer request + inspection (REVIEW) | `REVIEW, ADMIN` — `manufacturing/[id]/actions.ts:22` via `:130`/`:148` | `confirmMatchAction` `manufacturing/[id]/actions.ts:128` + `approveOrderAction` `:146` → `approveOrder` `src/lib/services/mfg-review.ts:108`; all-3 guard `:116`; items `CUSTOMER_REQUEST/INSPECTION/ENGINEERING` `:17` | **BUILT** | Correctly gated to REVIEW. Match is a **manual attestation** logged to `ActivityLog` (`mfg-review.ts:66`), not an automated 3-way comparison; approve is server-blocked until all three confirmed. |
| 8 | Expected date + delay alerts (PROCUREMENT) | expected date: `PROCUREMENT, ADMIN` `manufacturing/[id]/actions.ts:24` via `:166` | `assignFactoryAction` `manufacturing/[id]/actions.ts:164` → `assignFactory` `src/lib/services/mfg-review.ts:158` | **PARTIAL** | Expected date BUILT (PROCUREMENT). **Delay alerts NOT active** — only passive KPI counts `overdueMfgOrders`/`overdueInstallations` (`lib/executive/actions.ts:105`,`:111`; CEO card `executive/page.tsx:49`). No `notifyRole` on lateness. **(H2)** |
| 9 | Sales follow-up — send quote + daily timeline updates (SALES_REP) | `SENT` flag: `ADMIN, SALES_MANAGER, TECHNICAL_OFFICE, TEC_APPROVER` `lib/pricing/actions.ts:18` via `:569` — **SALES_REP excluded** | `updateQuotationStatus` `lib/pricing/actions.ts:565` (status flag only) | **MISSING** | No send-to-customer action (no email/customer notification); "sending" is a bare `SENT` status a **SALES_REP cannot even set**. **No daily timeline updates** — no scheduler/cron/digest anywhere. |
| 10 | Customer status — approve/price-edit/sample/inspect/reject (SALES_REP) | manual stage: `ADMIN` only `src/lib/actions/customers.ts:27`; quote approve/reject: PRICING_ROLES / `TEC_APPROVER,ADMIN` `lib/review/actions.ts:10` | `changeCustomerStage` `src/lib/actions/customers.ts:22`; `updateQuotationStatus` `lib/pricing/actions.ts:565`; inspect = `createInspectionAction` | **PARTIAL** | No unified SALES_REP "customer status" action. Manual stage change is **ADMIN-only** (else auto-derived); quote approve/reject not available to the rep; "inspect" is the only SALES-driven piece; **"sample" does not exist**. |
| 11 | Contracting — sign + assign owner + authorization (SALES+ACCOUNTING) | projects: `ADMIN, SALES_MANAGER, SALES_REP` `lib/contracts/actions.ts:9` via `:22`; social auto: `ADMIN, ACCOUNTING` `lib/accounting/actions.ts:14` | `createContract` `lib/contracts/actions.ts:20`; social auto-create in `addPayment` `lib/accounting/actions.ts:240`; APPROVED-only guard `src/lib/services/contract-core.ts:47` | **BUILT** | Sign (SALES for projects; ACCOUNTING auto-creates social on first payment) + authorization gate (contract refused unless `reviewStatus===APPROVED`). **"Assign owner" is NOT a contracting step** — ownership is set in step 2; contract records only `createdById`. |
| 12 | Accounting — down payment + invoice + statements + final sheet (ACCOUNTING) | payment/invoice/stmt: `ADMIN, ACCOUNTING`; **invoice issue: `ADMIN` only** `src/lib/finance/invoices.ts:16` | `addPayment` `lib/accounting/actions.ts:200`; `createInvoiceAction` `src/lib/finance/invoices.ts:25` / `issueInvoiceAction` `:54`; `createStatementAction` `src/lib/finance/statements.ts:24`; final sheet `getCustomerSheet` `lib/accounting/actions.ts:86` | **BUILT** | Payment refused unless APPROVED (`accounting/actions.ts:224`). SoD nuance: **issuing an invoice is ADMIN-only** — ACCOUNTING can create/cancel but not issue. |
| 13 | Manufacturing order — exec drawing + accessory card (PROCUREMENT?) | issue MO: `TEC_APPROVER, ADMIN` `lib/manufacturing/actions.ts:56`; exec drawing: `ADMIN, TECHNICAL_OFFICE` `technical-office/actions.ts:160`; accessory cost: `PROCUREMENT, ADMIN` `manufacturing/[id]/actions.ts:211` | `createManufacturingOrder` `lib/manufacturing/actions.ts:54`; `uploadDrawingAction` `technical-office/actions.ts:158`; accessory triple `addExtraItemAction`/`confirmExtraItemAction`/`setExtraItemCostAction` `manufacturing/[id]/actions.ts:43`/`:63`/`:209` | **BUILT** | **H1 CONFIRMED** — issuing the MO is **TEC_APPROVER/ADMIN, not PROCUREMENT** (guards: APPROVED + TEC_APPROVED drawing + contract + ≥1 payment, `manufacturing/actions.ts:80–97`). PROCUREMENT only enters the accessory unit cost; exec drawing is TECHNICAL_OFFICE. |
| 14 | Manufacturing — send to factory + follow-up + alerts (PROCUREMENT) | `PROCUREMENT, ADMIN` — factory `manufacturing/[id]/actions.ts:166`; follow-up `MFG_ROLES` `lib/manufacturing/actions.ts:10` via `:145` | `assignFactoryAction` `manufacturing/[id]/actions.ts:164`; `updateMfgStatus` `lib/manufacturing/actions.ts:143` w/ legal-transition guard `:158` | **PARTIAL** | Send-to-factory + status follow-up BUILT (PROCUREMENT). **"Alerts" passive only** — no active late-notification (H2). |
| 15 | Receive & store — receive from factory + store + record cost (PROCUREMENT) | receive: `MFG_ROLES` `lib/manufacturing/actions.ts:145` | `updateMfgStatus` READY→DELIVERED `lib/manufacturing/actions.ts:162–164` | **PARTIAL** | Receive BUILT (status flag). **"Store"/warehouse MISSING** — no inventory model (BL-57). **"Record cost" MISSING** — `ManufacturingOrder` has no cost field; only per-`ExtraItem.unitCost` (schema:1150) + optional `InstallationItem.cost` (schema:386). **H3 CONFIRMED**. |
| 16 | Installations — receive customer data + schedule + execute (INSTALLATIONS) | `ADMIN, INSTALLATIONS` `lib/installations/actions.ts:9` via `:57`/`:101` | `createInstallationOrder` `lib/installations/actions.ts:163→170` (auto on READY `lib/manufacturing/actions.ts:195`); `scheduleInstallation` `:55`; `updateInstStatus` `:99` | **BUILT** | **H4 REFUTED** — installation order IS created. "Receive customer data" inherited via MO→quotation→customer. **AUTHZ note:** `createInstallationOrder` is an exported `"use server"` fn with **no `requireRole`** (reachable directly; L-05 gap). |
| 17 | Extra items — breakage/factory-error/tec-error/customer-delay (INSTALLATIONS) | `INSTALLATIONS, ADMIN` `installations/[id]/actions.ts:31` + team-lead guard `src/lib/services/installation-extras.ts:17` | `addInstallationItemAction` `installations/[id]/actions.ts:29`; `REPLACEMENT_MAP` `installation-extras.ts:41` | **BUILT** | **H5 CONFIRMED** — `FaultType` enum = **5** (schema:336–342); replacement-eligible = **4** (CUSTOMER_DELAY excluded, `fault-investigations.ts:35`/`:228`). No auto replacement order (W-06). Chain: open=`REVIEW`, judge=`ADMIN`, issue replacement=`TEC_APPROVER`. |
| 18 | Project completion — photos + final report + feedback (INSTALLATIONS) | photos: `INSTALLATIONS, ADMIN` `installations/[id]/actions.ts:58`; feedback: `ADMIN, SALES_MANAGER, SALES_REP, INSTALLATIONS` `src/lib/actions/post-install.ts:21` | `addInstallationPhotoAction` `installations/[id]/actions.ts:56`; `createPostInstallReview` `src/lib/actions/post-install.ts:17` | **PARTIAL** | Photos BUILT (stored as a **URL string**, no upload/validation). **No "final report" action** → MISSING. **Feedback is MANUAL** — completion (`installations/actions.ts:128`) only recomputes stage; no survey trigger (W-07 gap). |

---

## Tally

| Verdict | Steps | Count |
|---|---|---|
| **BUILT** | 1, 2, 3, 6, 7, 11, 12, 13, 16, 17 | **10** |
| **PARTIAL** | 4, 8, 10, 14, 15, 18 | **6** |
| **MISSING** | 5, 9 | **2** |

---

## Hypotheses H1–H6 (independently verified)

| H | Claim | Verdict | Evidence |
|---|---|---|---|
| **H1** | Issue manufacturing order gated TEC_APPROVER/ADMIN, not PROCUREMENT | **CONFIRMED** | `createManufacturingOrder` requireRole `["TEC_APPROVER","ADMIN"]` — `lib/manufacturing/actions.ts:56`. |
| **H2** | Delay alerts are passive KPI, not active notifications | **CONFIRMED** | `overdueMfgOrders`/`overdueInstallations` are `count()` — `lib/executive/actions.ts:105`,`:111`; CEO KPI card `src/app/(dashboard)/executive/page.tsx:49`. No `notifyRole` on lateness. |
| **H3** | No full cost recording (PRC-R10) / no cost dashboard (PRC-R11) | **CONFIRMED** | Only `ExtraItem.unitCost` (schema:1150) + optional `InstallationItem.cost` (schema:386). No `ManufacturingOrder` cost field; no cost `_sum`/dashboard/margin anywhere. |
| **H4** | installationOrder never created | **REFUTED** | `prisma.installationOrder.create` — `lib/installations/actions.ts:170`, called on READY `lib/manufacturing/actions.ts:195`. Caveat: creator fn is ungated (L-05). |
| **H5** | 5 fault types; which are replacement-eligible | **CONFIRMED (5)** | `enum FaultType` = BREAKAGE, FACTORY_ERROR, TEC_ERROR, MEASUREMENT_ERROR, CUSTOMER_DELAY (`prisma/schema.prisma:336`). `REPLACEMENT_ELIGIBLE_FAULTS` = first **4** (`src/lib/services/fault-investigations.ts:35`); CUSTOMER_DELAY rejected `:228`. |
| **H6** | Feedback ownership: code vs SALES BRD | **RESOLVED** | `createPostInstallReview` gates `ADMIN, SALES_MANAGER, SALES_REP, INSTALLATIONS` (`src/lib/actions/post-install.ts:21`); status follow-up SALES-only(+ADMIN) `:72`. SALES is included (matches BRD) but INSTALLATIONS also creates; **manual, not event-driven**. |

---

## Process holes — every MISSING / PARTIAL, with `file:line`

### MISSING (2)

1. **Step 5 — Warehouse/Procurement pre-pricing costing does not exist.**
   No make-vs-buy, no availability check, no cost report. `Material` is an admin pricing catalog only
   (`lib/pricing/actions.ts:65`; managed in `lib/admin/actions.ts`). Every `PROCUREMENT` gate is
   post-approval (`src/app/(dashboard)/factories/actions.ts:13`, `src/app/(dashboard)/manufacturing/[id]/actions.ts:24`,
   `lib/manufacturing/actions.ts:16`). The claimed "cost report → pricing" (5→6) handoff is absent;
   pricing is driven by a static catalog.

2. **Step 9 — Sales quote-send + daily timeline updates do not exist.**
   No send-to-customer action (no email/customer notification). "Sending" is only the `SENT` enum flag set by
   `updateQuotationStatus` (`lib/pricing/actions.ts:565`), gated to `PRICING_ROLES` (`:18`/`:569`) which
   **excludes `SALES_REP`**. No scheduler/cron/daily-digest exists anywhere in the codebase.

### PARTIAL (6)

3. **Step 4 — "Address procurement" sub-step missing.**
   Receive-request + assign-engineer is built (`src/app/(dashboard)/technical-office/actions.ts:18`,`:89`),
   but nothing routes a request to procurement for costing before pricing (consequence of hole #1).

4. **Step 8 — Delay alerts are passive, not active (H2).**
   Expected date is set by `assignFactoryAction` (`src/app/(dashboard)/manufacturing/[id]/actions.ts:164`).
   Lateness surfaces only as CEO KPI **counts** (`lib/executive/actions.ts:105`,`:111`) — no notification
   to PROCUREMENT or anyone when an order/installation runs late.

5. **Step 10 — No SALES_REP customer-status action; "sample" absent.**
   Manual stage change is **ADMIN-only** (`src/lib/actions/customers.ts:27`); quotation approve/reject runs
   through `updateQuotationStatus` (PRICING_ROLES, no rep — `lib/pricing/actions.ts:569`) and
   `lib/review/actions.ts:10` (TEC_APPROVER). "inspect" is the only SALES-driven outcome; "sample" has no code.

6. **Step 14 — Manufacturing "alerts" passive only.**
   Send-to-factory + status follow-up built (`src/app/(dashboard)/manufacturing/[id]/actions.ts:164`;
   `lib/manufacturing/actions.ts:143`), but the "alerts" element is the same passive KPI as step 8 (H2).

7. **Step 15 — No warehouse/store layer; no cost recording (H3).**
   Receive is only a DELIVERED status flag (`lib/manufacturing/actions.ts:162`). No inventory/stock model
   exists (BL-57). No order-level or project cost is recorded — only per-`ExtraItem.unitCost` (schema:1150)
   and optional per-`InstallationItem.cost` (schema:386); no aggregation/dashboard (PRC-R10/PRC-R11 absent).

8. **Step 18 — No final report; feedback is manual, not event-driven (W-07).**
   Photos built (`src/app/(dashboard)/installations/[id]/actions.ts:56`) but stored as a raw URL string
   (no upload/validation, unlike inspection attachments). No "final report" artifact exists.
   `createPostInstallReview` exists (`src/lib/actions/post-install.ts:17`) but installation completion
   (`lib/installations/actions.ts:128`) triggers no survey — the satisfaction loop must be started by hand.

---

## Cross-cutting surprises (not step-scoped)

- **AUTHZ gap:** `createInstallationOrder` is an exported `"use server"` function with **no `requireRole`**
  (`lib/installations/actions.ts:163`). Its intended caller (`updateMfgStatus`) is gated, but the export is
  a directly-invocable server-action endpoint — a Law L-05 concern ("an action with no gate is a P0 defect
  even if no UI reaches it today"). *Flagged for a dedicated security review — not fixed here.*

- **Input-handling inconsistency:** installation photos accept a client-supplied URL string
  (`src/app/(dashboard)/installations/[id]/actions.ts:50–54`) with no file validation, whereas inspection
  attachments enforce magic-byte sniffing and reject SVG (`inspections/actions.ts:285`). Divergent trust model.

- **Misleading filename:** `lib/review/actions.ts` is *quotation approval* gated to **TEC_APPROVER/ADMIN**
  (`:10`), **not** the REVIEW role. The actual REVIEW-role triple-match lives in
  `src/app/(dashboard)/manufacturing/[id]/actions.ts:128`/`:146`.

- **Claimed-role accuracy:** the BRD "claimed role" was inaccurate for steps **1** (no customer entry point),
  **3** (fragmented across SALES/INSPECTION_MANAGER/INSPECTION_REP), **9 & 10** (SALES_REP has almost no
  authority), and **13** (issuing = TEC_APPROVER, not PROCUREMENT — H1).

---

*Audit complete. Read-only. HEAD `75d3a0e`. No source files were modified; this report is the only file written.*
