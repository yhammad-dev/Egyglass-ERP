---
module: HR
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 7
ready_for_uat: YES
---

# HR Module — UAT Discovery

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/hr` | Employees + leave requests | `hr/page.tsx` → `hr-client.tsx` (642 LOC) |

| Action | File | Roles |
|---|---|---|
| `getEmployees` | `lib/hr/actions.ts:10` | ADMIN, HR |
| `createEmployee` | `:42` | ADMIN, HR |
| `updateEmployee` | `:87` | ADMIN, HR |
| `getLeaveRequests` | `:129` | ADMIN, HR |
| `createLeaveRequest` | `:163` | ADMIN, HR |
| `updateLeaveStatus` | `:208` | ADMIN, HR |

- Page guard: `requireRole(["ADMIN","HR"])`.
- Models: `Employee` (nameAr, department:`Department`, position, hireDate, salary?, isActive); `LeaveRequest` (employeeId, type, startDate, endDate, status:`LeaveStatus`, notes).

## Screen 1 — Employees
- List + create/edit dialogs. Fields: nameAr, department (enum), position, hireDate, salary (optional, `nonnegative`), isActive (edit).
- **Validation:** `employeeSchema`/`updateEmployeeSchema` — required name/dept/position/hireDate; salary ≥ 0.
- **Sensitivity:** salary is PII; only ADMIN/HR can read (gated). Good.

## Screen 2 — Leave requests
- List + create + status change (approve/reject via `LeaveStatus`).
- **Validation:** employeeId, type, startDate, endDate required; notes optional.
- **Business gap (P3):** no `startDate ≤ endDate` check; no overlap detection.

## Missing features
- No date-range validation on leave (LEAVE-OBS-1).
- No leave-balance/accrual tracking.
- No employee↔User link (Employee is standalone from auth User).
- No delete/terminate employee (only isActive toggle).

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| HR-OBS-1 | P3 | Leave `startDate>endDate` accepted. Add cross-field check. |
| HR-OBS-2 | Low | Salary shown to any HR user; confirm intra-HR confidentiality not required. |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| HR-01 | Login HR, open `/hr` | Employees + leave lists load |
| HR-02 | Login SALES_REP | Redirected to `/dashboard` |
| HR-03 | Create employee (all fields) | Created; appears in list; audit logged |
| HR-04 | Create employee salary = -1 | Rejected (nonnegative) |
| HR-05 | Edit employee → isActive off | Persists |
| HR-06 | Create leave request | Appears PENDING |
| HR-07 | Leave startDate after endDate | **Currently accepted** (validates HR-OBS-1) |
| HR-08 | Approve/reject leave | Status updates; audit logged |

**Ready for UAT? YES.** Address HR-OBS-1 (date validation) in a later fix wave.
