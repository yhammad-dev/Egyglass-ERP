---
module: Projects
generation_date: 2026-07-06
inspector: Atlas UAT Discovery Agent
project: EgyGlass ERP
priority: 8
ready_for_uat: YES
---

# Projects Module — UAT Discovery

## Overview
| Route | Screen | Impl |
|---|---|---|
| `/projects` | Projects list + create/edit + link quotations | `projects/page.tsx` → `projects-client.tsx` (489 LOC) |

| Action | File | Roles |
|---|---|---|
| `getProjects` | `lib/projects/actions.ts:10` | ADMIN, PROJECTS |
| `createProject` | `:52` | ADMIN, PROJECTS |
| `updateProject` | `:105` | ADMIN, PROJECTS |
| `linkQuotationToProject` | `:153` | ADMIN, PROJECTS |
| `getUnlinkedQuotations` | `:189` | ADMIN, PROJECTS |
| `getAssignableManagers` | `:214` | ADMIN, PROJECTS |
| `getCustomersForProjects` | `:230` | ADMIN, PROJECTS |

- Page guard: `requireRole(["ADMIN","PROJECTS"])`.
- Model: `Project` (nameAr, customerId, managerId?, status:`ProjectStatus`, startDate?, endDate?, notes?) + quotations relation (`_count`).

## Screens
- **List:** project rows with customer, manager, status, quotation count.
- **Create/Edit dialog:** nameAr + customer (dropdown from `getCustomersForProjects`, soft-delete filtered), manager (optional), status, dates, notes. `projectSchema`/`updateProjectSchema`.
- **Link quotation:** pick an unlinked quotation (`getUnlinkedQuotations`, optionally by customer) → sets `quotation.projectId`.
- **Permissions:** ADMIN/PROJECTS only.

## Missing features / gaps
- **PROJ-OBS-1 (P3):** `getAssignableManagers` returns **all active users**, not only PROJECTS/manager-capable roles — a non-manager can be set as project manager. Confirm intended.
- No `startDate ≤ endDate` validation.
- No unlink-quotation action (can link, cannot unlink via UI).
- Link does not check the quotation belongs to the project's customer (cross-customer link possible).

## Known / suspected issues
| ID | Sev | Note |
|---|---|---|
| PROJ-OBS-1 | P3 | Manager dropdown unrestricted by role. |
| PROJ-OBS-2 | Low | Quotation can be linked to a project of a different customer. |

## UAT Test Cases
| # | Steps | Expected |
|---|---|---|
| PROJ-01 | Login PROJECTS, open `/projects` | Projects load |
| PROJ-02 | Login SALES_REP | Redirected to `/dashboard` |
| PROJ-03 | Create project (name+customer) | Created; audit logged |
| PROJ-04 | Create with no customer | Validation error |
| PROJ-05 | Edit project status/dates | Persists |
| PROJ-06 | Link an unlinked quotation | quotation.projectId set; count increments |
| PROJ-07 | Link quotation of another customer | **Currently allowed** (validates PROJ-OBS-2) |
| PROJ-08 | Assign a non-manager user as manager | **Currently allowed** (validates PROJ-OBS-1) |

**Ready for UAT? YES.** PROJ-OBS-1/2 are hardening items, not blockers.
