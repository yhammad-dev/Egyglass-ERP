---
module: Inspections
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 4
ready_for_uat: YES
---

# Inspections Module — UAT Discovery

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/inspections` | Inspections list/board | `inspections/page.tsx` → `inspections-client.tsx` (682 LOC) |
| `/inspections/[id]` | Inspection detail | `[id]/page.tsx` → `inspection-detail-client.tsx` (331 LOC) |

| Action | File | Roles |
|---|---|---|
| `createInspectionAction` | `inspections/actions.ts:55` | ADMIN, INSPECTION_MANAGER |
| `scheduleInspectionAction` | `:29` | ADMIN, INSPECTION_MANAGER |
| `getInspectionDetail` | `:76` | ADMIN, INSPECTION_MANAGER |
| `addMeasurements` | `:138` | ADMIN, INSPECTION_MANAGER |
| `addInspectionAttachment` | `:178` | ADMIN, INSPECTION_MANAGER |
| `updateInspectionStatus` | `:232` | ADMIN, INSPECTION_MANAGER |

- Models: `InspectionRequest` (customerId, location, address, phone, type, notes, status, scheduledAt, dueDate, assigneeId, deletedAt). Status: REQUESTED → SCHEDULED → DONE → OVERDUE. Type: PRICING | EXECUTION. Location: INSIDE_CAIRO | OUTSIDE_CAIRO.
- Soft-delete: `deletedAt:null` applied on list + active reads (`services/inspections.ts:61,99,108`).
- On status=DONE → notifies TECHNICAL_OFFICE department (`actions.ts:261-278`).

## Screen 1 — Inspections list
- Filters/search, create dialog (customer, location, address, phone, type, notes).
- **Validation:** all required except notes; enums validated server-side (`createSchema`).
- **Permissions:** ADMIN/INSPECTION_MANAGER write; page requires session.

## Screen 2 — Inspection detail
- Schedule (scheduledAt + assignee), record measurements (width>0, height>0, notes), add attachment (fileName, filePath), change status.
- **Validation:** `measurementsSchema` width/height `positive()`; `scheduleSchema` all required.
- Measurements stored as structured rows in `InspectionMeasurement` (description, width, height, unit, quantity) — see BL-81/SCR-018. The old ActivityLog-text path was fully removed.

## Missing features
- SLA/OVERDUE is a status value; verify an automated job flips REQUESTED/SCHEDULED→OVERDUE past `dueDate` (recent commit d6c6161 mentions "OVERDUE inspections" — verify).
- Attachment upload has **no file validation** (fileName/filePath free strings) → see UPL-001 in `security-review.md`.

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| INS-OBS-1 | Med | OVERDUE transition mechanism — confirm it is automatic (cron/query) vs manual. |
| INS-OBS-2 | Med (P2 UPL-001) | Attachment path unvalidated; latent stored-XSS/redirect. |
| INS-OBS-3 | Low | `getInspectionDetail` not row-scoped by assignee — any INSPECTION_MANAGER sees all (acceptable by role). |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| INS-01 | ADMIN create inspection with all fields | Created; appears REQUESTED |
| INS-02 | Create with empty address | Validation error |
| INS-03 | SALES_REP open `/inspections` create | Create action denied (role) |
| INS-04 | Schedule with assignee + date | Status→SCHEDULED; assignee shown |
| INS-05 | Record measurements width=0 | Rejected (must be positive) |
| INS-06 | Record valid measurements | Logged; visible in detail |
| INS-07 | Add attachment | Stored; listed |
| INS-08 | Set status DONE | TECHNICAL_OFFICE users notified |
| INS-09 | Inspection past due date | Shows/flips OVERDUE (validates INS-OBS-1) |
| INS-10 | (Audit) status change | Logged in `/audit` |

**Ready for UAT? YES** (mature, 1055 LOC). Verify OVERDUE automation (INS-OBS-1) and note UPL-001.
