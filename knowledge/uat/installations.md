---
module: Installations
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 5
ready_for_uat: YES
---

# Installations Module — UAT Discovery

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/installations` | Installation orders board | `installations/page.tsx` → `installations-client.tsx` (289 LOC) |

| Action | File | Roles |
|---|---|---|
| `getInstallationOrders` | `lib/installations/actions.ts:10` | ADMIN, INSTALLATIONS |
| `scheduleInstallation` | `:54` | ADMIN, INSTALLATIONS |
| `updateInstStatus` | `:98` | ADMIN, INSTALLATIONS |
| `getInstallationTeamLeads` | `:133` | ADMIN, INSTALLATIONS |
| `createInstallationOrder` | `:151` | internal (from manufacturing) |

- Page guard: `requireRole(["ADMIN","INSTALLATIONS"])`.
- Model: `InstallationOrder` (manufacturingOrderId, teamLeadId, scheduledAt, status:`InstStatus`). Linked via ManufacturingOrder → Quotation → Customer.
- `createInstallationOrder` is idempotent (returns existing if present, `:153-156`).

## Screen 1 — Installation board
- Table: Quotation number, Customer, Team lead, Scheduled date, Status.
- **Schedule form:** teamLeadId (dropdown from `getInstallationTeamLeads` = users with INSTALLATIONS role), scheduledAt. All required (`scheduleSchema`). Sets status→SCHEDULED.
- **Status update:** `InstStatus` enum via `z.nativeEnum` (server-validated).
- **Permissions:** ADMIN/INSTALLATIONS only.

## Missing features
- No manual create UI (orders originate from manufacturing chain) — confirm the trigger point (where `createInstallationOrder` is called; likely when mfg order READY/DELIVERED — **verify the wiring**).
- No status-transition guard (free transitions).

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| INST-OBS-1 | Med | Confirm where `createInstallationOrder` is invoked in the mfg→install handoff; if unwired, board stays empty. |
| INST-OBS-2 | Low | teamLead dropdown empty if no user has INSTALLATIONS role — seed data must include one. |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| INST-01 | Login INSTALLATIONS, open board | Orders listed |
| INST-02 | Login SALES_REP | Redirected to `/dashboard` |
| INST-03 | Schedule order (lead + date) | Status→SCHEDULED; lead+date shown |
| INST-04 | Schedule with missing date | Validation error |
| INST-05 | Change status | Persists; audit logged |
| INST-06 | Progress a mfg order to trigger install order | Install order appears (validates INST-OBS-1) |
| INST-07 | Empty team-lead list | Verify seed has an INSTALLATIONS user (INST-OBS-2) |

**Ready for UAT? YES** — pending confirmation of the mfg→install trigger (INST-OBS-1).
