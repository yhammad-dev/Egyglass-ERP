# MVP Spec — EgyGlass ERP

**Vertical slice:** the customer journey from first lead to inspection request.
**Modules:** Sales CRM + Inspections.
**MVP goal:** an impressive yet realistic demo for the CEO (Amr) that shows the value
of a fully owned system.

> Note: this spec is in English (for the agent). The product **UI is Arabic/RTL**.
> Domain terms appear with Arabic in parentheses for accuracy.

---

## 1. Entities & their logic

### 1.1 User (employee)
- Fields: name, email/login, hashed password, role, department, status (active/suspended).
- Roles: `ADMIN`, `SALES_MANAGER`, `SALES_REP`, `INSPECTION_MANAGER`, `VIEWER`.
- A SALES_MANAGER can assign customers to reps.
- **Absence coverage:** a rep can cover an absent colleague's customers (they appear
  temporarily in the covering rep's list, flagged "coverage").

### 1.2 Customer (Customer 360)
- Fields: name, phone (primary + alt), type, source, owner (rep), address, notes.
- **Type:** `INDIVIDUAL` (فردي) / `ENGINEER` (مهندس) / `COMPANY` (شركة).
- **Source:** `AD` (إعلان) / `REFERRAL` (توصية) / `WHATSAPP` / `EXHIBITION` (معرض) / `VISIT` (زيارة).
- **Repeat customer:** a flag (auto-set when they have more than one deal) — enables
  the 5% cashback eligibility.
- Unified profile shows: all interactions + quotations + inspection requests (full history).
- Customer pipeline stage (below).

### 1.3 Pipeline (sales stages)
Ordered statuses:
```
NEW (جديد)
 → PRICED (تم التسعير)
   → FOLLOW_UP (متابعة)
     → INSPECTION (معاينة)
     → EXECUTION (تنفيذ)
     → RE_INSPECTION_FOLLOWUP (متابعة بعد المعاينة)
     → REJECTED (رفض)
```
- Stage transitions are recorded in `ActivityLog` (who + when).
- **REJECTED:** requires a written reject reason. After rejection there is **no
  follow-up** (the customer drops out of active follow-up lists).

### 1.4 Interaction (daily follow-up)
- A timestamped follow-up log per customer: type (call/whatsapp/visit/note), note,
  user, time. Shown as a timeline on the customer profile.

### 1.5 Quotation
- Linked to a customer. Contains line items (QuotationItem): description, quantity,
  unit price (EGP), line total.
- **3-day validity** from issue date (auto-computed `validUntil`) + a text clause
  "prices subject to change".
- **Discount engine:**
  - Standard discount up to **19%** (applied by the rep).
  - **+5% cashback** for repeat customers (auto when eligible).
  - Any discount **above 19%** requires approval: SALES_MANAGER → (in the full scope:
    board chairman). In the MVP: status `PENDING_APPROVAL` + SALES_MANAGER approval is enough.
- Totals are computed **server-side** (never trust UI math): subtotal, discount,
  cashback, **VAT 14%**, final total.
- Quotation status: `DRAFT` / `SENT` / `PENDING_APPROVAL` / `APPROVED` / `EXPIRED`.
- "Send WhatsApp" button = placeholder only in the MVP (generates copy-ready quote
  text, no real API).

### 1.6 InspectionRequest
- Created from a customer in an appropriate stage. Fields: location, full address,
  phone, attachments (photos).
- **Auto-routing:** on creation the Technical Office is notified (MVP: internal
  flag/notification only, no full module).
- **SLA:** 2 business days inside Cairo, 3–4 business days outside. `dueDate` is
  auto-computed and a status indicator (green/amber/red) shows proximity to the deadline.
- Scheduling: date + assigned inspector. A simple inspections list/calendar.
- Statuses: `REQUESTED` / `SCHEDULED` / `DONE` / `OVERDUE`.
- **Photo upload from site** (album per request).
- Expected volume: ~40 inspections/week (2–7/day) — design lists with pagination & filters.

### 1.7 Attachment
- Photos/files linked to a customer, quotation, or inspection. Stored on the VPS
  filesystem (or S3-compatible later).

### 1.8 ActivityLog
- Every write: user, action, entity, id, time, (optional before/after value).

---

## 2. Screens in the MVP

1. **Login** (Auth.js credentials).
2. **Dashboard** — KPIs: new customers, active quotations, inspections due today/overdue,
   pipeline distribution (simple chart).
3. **Customers list** — table with filters (type, source, rep, stage) + search + pagination.
4. **Customer profile (Customer 360)** — data + interactions timeline + quotations +
   inspections + action buttons.
5. **Create/edit customer.**
6. **Create/view quotation** — items + discount engine + totals + VAT + WhatsApp text.
7. **Inspections list + calendar** — with SLA indicators.
8. **Create/schedule inspection request** + photo upload.
9. **User management** (ADMIN only) — add employee, assign role/department.

---

## 3. RBAC matrix

| Action | ADMIN | SALES_MANAGER | SALES_REP | INSPECTION_MANAGER | VIEWER |
|--------|:---:|:---:|:---:|:---:|:---:|
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ |
| See all customers | ✅ | ✅ | own only | ✅ | ✅ |
| Assign customers to reps | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create/edit customer | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create quotation | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve discount > 19% | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create inspection request | ✅ | ✅ | ✅ | ✅ | ❌ |
| Schedule/close inspection | ✅ | ❌ | ❌ | ✅ | ❌ |
| See reports/Dashboard | ✅ | ✅ | limited | ✅ | ✅ |

---

## 4. MVP reports (simple)
- Rep performance (customer count, quotations, rejection rate) — weekly/monthly.
- New customers by source.
- Rejection analysis (most common reasons).
- Inspections: done vs overdue (SLA).

---

## 5. Definition of Done (MVP)
- [ ] I can log in as different roles and actually see different permissions.
- [ ] I can create a customer, move them through the pipeline, and log interactions.
- [ ] I can make a quotation with correct discount + 14% VAT + 3-day validity, with
      accurate totals.
- [ ] Discount > 19% is held for manager approval.
- [ ] I can create an inspection request, SLA is computed, and I can upload photos and schedule it.
- [ ] The UI is Arabic RTL and clean.
- [ ] Every write is recorded in ActivityLog.
- [ ] `npm run build` passes with no errors.
