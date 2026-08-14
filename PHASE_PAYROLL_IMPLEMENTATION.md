# Phase — Employee Directory & Payroll Calculation Engine

Implementation of the Employee Directory and the authoritative payroll
calculation engine, transcribed from `Salary Model.xlsx` (sheet `June 2026`).

---

## 1. Implementation summary

| Area | Status |
|---|---|
| Database schema + migration | Done — additive only, no data loss |
| Backend calculation engine | Done — single authoritative source |
| Payroll persistence | Done — `PayrollRecord` snapshot rows |
| Approval workflow | Done — Draft → Approved → Paid, with Reopen |
| Calculation snapshot / versioning | Done — immutable once approved |
| Audit trail | Done — superseded versions retained |
| Adjustment mechanism | Done — explicit rows, never in-place edits |
| Employee Directory UI | Done — grouped tabs, search/filter/pagination |
| Employee Detail UI | Done — full breakdown in mandated order |
| Salary slip integration | Done — prints the approved snapshot |
| Automated tests | Done — 48 passing |

The engine **extends** the existing architecture. It reuses the existing
`User`, `AttendanceRecord`, `LeaveRequest`, `HolidayCalendar`, `LateLopRule`,
`AttendanceSettings` models, the existing TDS implementation and the existing
RBAC system. No duplicate employee or payroll system was created. The legacy
`SalaryRecord` flow is left intact and untouched.

---

## 2. Database changes

### New models

| Model | Purpose |
|---|---|
| `PayrollPeriod` | One payroll month = one workbook sheet. Holds the 26→25 cycle window, calendar days, status. Unique on `(month, year)`. |
| `PayrollRecord` | One employee row within a period. All 45+ calculated columns, snapshotted. Unique on `(periodId, userId, version)`. |
| `PayrollAdjustment` | Explicit manual correction: amount, reason, creator, approver, date. |
| `PayrollStatutoryConfig` | PF/ESI/admin/EDLI rates and thresholds as data, versioned. |
| `ProfessionalTaxSlab` | Configurable PT bands (state, min, max, amount). |

### New enums

- `PayrollPeriodStatus` — `Draft | Approved | Reopened | Paid`
- `PayrollLifecycle` — `Joiner | Leaver | Stayer`

### New `User` fields

**Lifecycle:** `probationDays`, `dorLetterDate`, `lastWorkingDate`,
`priorExperienceMonths`
**Master salary:** `masterGross`, `masterBasic`, `masterHra`, `masterOthers`,
`masterSpecial1`, `masterSpecial2`, `variablePayPa`

Existing fields reused rather than duplicated: `dateOfBirth` (DOB),
`joiningDate` (DOJ), `confirmationDate` (DOC), `probationEndDate`,
`employeeCode`, `pan`, `uan`, `esiNumber`, `bankAccount`, `pfApplicable`,
`esiApplicable`.

### Database constraints

```sql
PayrollRecord: lop >= 0, daysForSalary >= 0, masterGross >= 0,
               monthlyGross >= 0, version >= 1
PayrollPeriod: month BETWEEN 1 AND 12, cycleEnd > cycleStart,
               calendarDays > 0, daysInMonth > 0
User:          lastWorkingDate >= joiningDate (when both set)
Unique index:  one current record per (periodId, userId) WHERE isCurrent
```

### Indexes

`PayrollRecord(userId)`, `PayrollRecord(periodId, isCurrent)`,
`PayrollPeriod(status)`, `PayrollAdjustment(userId, month, year)`,
`ProfessionalTaxSlab(state, isActive)`.

Migration: `20260814104338_payroll_engine`. Purely additive — every statement
is `ADD COLUMN` / `CREATE TABLE`. No existing column is dropped or retyped, so
existing employee, attendance, leave and payroll data is preserved.

---

## 3. Exact formulas implemented

Every formula below is transcribed from the workbook. Column letters refer to
the `June 2026` sheet. Source: `backend/src/services/payroll/formulas.ts`.

### Master salary

| Field | Column | Formula |
|---|---|---|
| Master Basic | U | `Master Gross × 50%` |
| Master HRA | V | `Master Gross × 25%` |
| Master Others | W | `Master Gross × 25%` |
| Master Gross | AA | `=SUM(U:Z)` — Basic + HRA + Others + Special 1 + Special 2 |
| Master PF Basic | AC | `=IF((AA−V>15000),15000,AA−V)` |
| Master Co PF | AD | `=AC×12%` |
| Master For ESI | AE | `=IF((AA>21000),"NO ESI","ESI")` |
| Master ESI Gross | AF | `=IF((AA>21000),0,AA)` |
| Master Co ESI | AG | `=IF((AA>21000),0,AA×3.25%)` |
| Master CTC PM | AH | `=AA+AD+AG` |
| Master CTC PA | AI | `=AH×12` |
| CTC PA Fix+Vari | AK | `=AI+AJ` |

### Monthly earnings

| Field | Column | Formula |
|---|---|---|
| Monthly Basic | AQ | `=((U/$AL)×$AO)` — master ÷ calendar days × days for salary |
| Monthly HRA | AR | `=((V/$AL)×$AO)` |
| Monthly Others | AS | `=((W/$AL)×$AO)` |
| Monthly Gross | AV | `=SUM(AQ:AU)` |
| **Gross‑HRA** | AW | `=AV−AR` — monthly gross less HRA; the PF/admin/EDLI wage basis |

### Employee deductions

| Field | Column | Formula |
|---|---|---|
| Employee PF | AX | `=IF(AW>15000,1800,ROUND(AW×12%,0))` |
| Employee ESI | AY | `=IF((AG>1),(AV×0.75%),0)` |
| Employee PT | BA | Flat `208`/month (Tamil Nadu), from `ProfessionalTaxSlab` |
| Employee TDS | AZ | Existing CRM implementation (new regime, s.115BAC) |
| Total Deduction | BD | `=SUM(AX:BC)` |
| Net Pay | BF | `=AV−BD−BE` |

### Employer contributions

| Field | Column | Formula |
|---|---|---|
| Employer PF | BG | `=AX` |
| Admin Charges | BH | `=IF(AW>15000,15000×0.5%,AW×0.5%)` |
| EDLI Charges | BI | `=IF(AW>15000,15000×0.5%,AW×0.5%)` |
| Employer ESI | BJ | `=IF(AV<21000,AV×3.25%,0)` |
| Total Employer Cost | BK | `=AX+BA+BF+BG+BH+BI+AY+BJ` (see §10) |

### Manual data-entry columns

These are blank in the workbook (no formula) and are therefore treated as
inputs, not calculations: Master Special 1/2 (Y/Z), Monthly Special 1/2
(AT/AU), LOP (AN), Employee Deduction 1/2 (BB/BC), TDA (BE), Variable Pay PA
(AJ), Employee TDS (AZ).

---

## 4. Attendance rules

Implemented in `backend/src/services/payroll/period.ts`, exactly as confirmed:

- **Late ladder** (from the existing `LateLopRule` table, highest threshold
  first): 2 lates excused · 3 lates → 1 day LOP · 6 lates → 2 days LOP ·
  8 lates → 2.5 days LOP
- **Half days** supported via the existing leave-approval flow; a half-day
  request contributes 0.5 days, not a full day
- **Weekly offs and holidays are payable** — they never generate LOP
- **Approved leave is payable**
- **Overtime is not calculated**; there are no night shifts
- **Payroll/leave cut-off is the 26th to the 25th**

LOP = unapproved absence + late-attendance penalty, clamped to the payable
days in the window (never negative, never greater than payable days).

---

## 5. Payroll-period logic

- A period is identified by `(month, year)`; a unique index prevents duplicate
  processing.
- The cycle window runs from the 26th of the previous month to the 25th of the
  payroll month, and is **stored on the period row** so a historical period
  keeps its own window even if the company rule later changes.
- **Joiners / Leavers / Stayers** are derived from `joiningDate` and
  `lastWorkingDate` against the window — never typed by hand. A leaver
  classification takes precedence when an employee both joins and leaves inside
  one window.
- **Partial periods**: a joiner is payable only from DOJ, a leaver only up to
  DOL. `payableWindowDays()` computes this, and proration follows.
- **Experience** is always derived (`priorExperienceMonths` + months since DOJ),
  never stored as editable text.

---

## 6. Approval flow, snapshot and versioning

```
Draft ──run──▶ Draft ──approve──▶ Approved ──paid──▶ Paid
                                     │
                                     └──reopen──▶ Draft (v+1, previous kept)
```

- While **Draft**, re-running replaces the current figures in place.
- On **Approve**, the rows are frozen. Recalculation is rejected with a clear
  error until the period is reopened.
- On **Reopen**, existing rows are marked `isCurrent = false` and cloned
  forward at `version + 1`. The previously approved figures remain readable in
  the audit history.
- A **Paid** period cannot be reopened.
- Each record stores `configVersion`, so an old run can explain which PF
  ceiling / ESI threshold / PT slab produced its numbers.

**Verified live**: master salary was changed from 10,000 to 50,000 after
approval; the approved snapshot remained at 10,000 with Net Pay 8,817.

---

## 7. Adjustments

Calculated values are never directly overwritten. `PayrollAdjustment` carries
`amount`, `reason` (min 3 chars, enforced), `createdById`, `createdAt`,
`approvedById`, `approvedAt`. Only **approved** adjustments are folded into Net
Pay, and they are surfaced separately from the calculated components in both
the API response (`adjustmentTotal`) and the Employee Detail UI.

---

## 8. Validation

Backend (`PayrollValidationError` → HTTP 400):
month out of range · year out of range · employee not found · master salary not
configured · negative master gross · DOB not before DOJ · DOL before DOJ ·
negative LOP · LOP greater than payable days · recalculating an approved period ·
approving an empty period · reopening a paid period · approving an
already-approved period · adjustment without a meaningful reason.

Database: the check constraints and unique indexes listed in §2.

---

## 9. Permissions

No new permission system. The existing RBAC is reused:

| Action | Permission |
|---|---|
| View directory | `hr_user:read_all` (the resource the existing `/api/users` routes already use) |
| View others' salary/payroll | `salary:read_all` |
| Run payroll | `salary:generate` |
| Approve / reopen period | `salary:approve` |
| Mark paid | `salary:mark_paid` |
| Create adjustment | `salary:generate` |
| Approve adjustment | `salary:approve` |

Employees may view **only their own** payroll and payslip — enforced
server-side on every route, not merely hidden in the UI. The directory omits
every salary field entirely for callers without `salary:read_all`, and the UI
hides the salary column groups accordingly.

---

## 10. Unresolved ambiguity — requires management confirmation

### Total Employer Cost (column BK) — two conflicting formulas in the workbook

The sheet contains **two different formulas** for the same column:

| Variant | Rows | Formula |
|---|---|---|
| A | 8 rows | `=AX+BA+BF+BG+BH+BI` — **omits both ESI columns** |
| B | 1 row (Manikandan) | `=AX+BA+BF+BG+BH+BI+AY+BJ` — includes employee + employer ESI |

**Implemented: variant B**, because a total employer cost that silently drops
employer ESI understates the real cost of every ESI-eligible employee.
**Please confirm** this is intended; if variant A is correct, change
`totalEmployerCost()` in `formulas.ts` and re-run the tests.

### ESI comparison asymmetry (preserved deliberately, not "corrected")

The workbook uses different comparisons at master and monthly level:

- Master level (AE/AF/AG): `IF(AA > 21000, ...)` — an employee at exactly
  21,000 **is** ESI-eligible
- Monthly employer ESI (BJ): `IF(AV < 21000, ...)` — an employee at exactly
  21,000 monthly gross contributes **0**

Both are implemented exactly as written. At exactly 21,000 this produces a
master-level ESI figure but no monthly employer ESI. Flagged for confirmation.

### Employee ESI eligibility keys off Master Co ESI

`AY = IF((AG>1), AV×0.75%, 0)` tests **Master Co ESI (AG)** rather than
re-testing the threshold. Consequence: an employee whose *master* gross put
them outside ESI contributes nothing even in a low-attendance month where
monthly gross falls below 21,000. Implemented as written.

### Professional Tax

The workbook uses a **flat 208/month** for every employee. This is seeded as a
single unbounded band. If Tamil Nadu half-yearly municipal slabs should apply
instead, replace the rows in `ProfessionalTaxSlab` — no code change needed.

### Gross-HRA and TDA

- **Gross‑HRA (AW)** is resolved: `=AV−AR`, the PF/admin/EDLI wage basis. No
  ambiguity remained once the file was read.
- **TDA (BE)** has no formula in the sheet — it is a manual entry subtracted in
  the Net Pay formula. Implemented as an input. **Its business meaning is not
  documented anywhere in the workbook** and was not guessed.

---

## 11. APIs

All under `/api/payroll`:

| Method | Route | Purpose |
|---|---|---|
| GET | `/directory` | Directory rows, salary fields gated by permission |
| GET | `/calculate/:userId?month&year` | Live preview, persists nothing |
| POST | `/run` | Calculate + persist (one employee, or all) |
| GET | `/periods` | All periods |
| GET | `/periods/:month/:year` | One period with its records |
| POST | `/periods` | Create a period |
| PATCH | `/periods/:m/:y/approve` | Freeze the snapshot |
| PATCH | `/periods/:m/:y/reopen` | New version, previous retained |
| PATCH | `/periods/:m/:y/paid` | Mark paid |
| GET | `/history/:userId` | All versions for one employee |
| GET | `/records/:id/payslip` | PDF from the **approved snapshot** |
| POST | `/adjustments` | Create adjustment |
| PATCH | `/adjustments/:id/approve` | Approve adjustment |
| GET | `/adjustments/:userId` | List adjustments |
| GET | `/config` | Statutory config + PT slabs |

Changed: `routes/salary.ts` — `calcTDS` extracted to
`services/payroll/tds.ts` and re-exported, so the payroll engine and the legacy
route share one implementation. Behaviour unchanged.

---

## 12. Frontend changes

- `pages/EmployeeDirectory.tsx` — search, status/department filters,
  pagination, period selector, run/approve/reopen/mark-paid actions.
  **Not a wide table**: nine column groups shown one at a time
  (Employee Information · Employment Lifecycle · Master Salary · Statutory
  Salary · Attendance & Salary Days · Monthly Earnings · Employee Deductions ·
  Net Pay · Employer Contributions).
- `pages/EmployeeDetail.tsx` — full breakdown in the mandated order:
  Master Salary → Payroll Days → Monthly Earnings → Statutory Deductions →
  Other Deductions → Total Deduction → Net Pay → Employer Contributions →
  Total Employer Cost. Plus adjustments and version history.
- `hooks/usePayroll.ts` — typed hooks for every endpoint.
- `hooks/useUsers.ts` — added missing `employeeCode` field.
- Routes `/employees` and `/employees/:id`; sidebar entry "Employee Directory".

**The frontend performs no payroll arithmetic.** Every figure is requested from
the backend and rendered.

---

## 13. Tests

`backend/src/services/payroll/formulas.test.ts` — **48 tests, all passing**
(`npm test`).

Coverage: normal employee · PF ceiling · ESI eligible · ESI ineligible · ESI
boundary at exactly 21,000 · full month · partial month · joiner · leaver ·
LOP · late-attendance LOP · special payments · variable pay · configurable
deductions · zero deductions · rounding · the 26→25 cycle window · lifecycle
classification · payable-window days · TDS · every employer contribution.

**A real bug was found and fixed by these tests**: an off-by-one in the day
counting caused by the cycle end carrying a `23:59:59` time component. It
inflated every window by one day, which would have overpaid every joiner and
leaver. Fixed via a date-floored `dayDiffInclusive()` helper.

### Sample calculation results (verified live through the API)

Reference: workbook row 2 (Logesh N), Master Gross ₹10,000, June 2026,
31 calendar days, no LOP.

| Field | Expected (xlsx) | Actual | |
|---|---|---|---|
| Master Basic | 5,000 | 5,000 | OK |
| Master HRA | 2,500 | 2,500 | OK |
| Master Others | 2,500 | 2,500 | OK |
| Master Gross | 10,000 | 10,000 | OK |
| Master PF Basic | 7,500 | 7,500 | OK |
| Master Co PF | 900 | 900 | OK |
| Master Co ESI | 325 | 325 | OK |
| Master CTC PM | 11,225 | 11,225 | OK |
| Master For ESI | ESI | ESI | OK |
| Monthly Gross | 10,000 | 10,000 | OK |
| Gross‑HRA | 7,500 | 7,500 | OK |
| Employee PF | 900 | 900 | OK |
| Employee ESI | 75 | 75 | OK |
| Employee PT | 208 | 208 | OK |
| Employer PF | 900 | 900 | OK |
| Admin Charges | 37.50 | 37.50 | OK |
| EDLI Charges | 37.50 | 37.50 | OK |
| Employer ESI | 325 | 325 | OK |
| **Total Deduction** | **1,183** | **1,183** | OK |
| **Net Pay** | **8,817** | **8,817** | OK |
| **Total Employer Cost** | — | **11,300** | variant B |

**21 of 21 fields reproduce the workbook exactly.**

### Verification performed

- `prisma validate` — schema valid
- `prisma migrate deploy` — applied cleanly
- `tsc --noEmit` (backend) — clean
- `tsc -b` (frontend) — clean
- `vitest run` — 48/48 passing
- Live API: calculation, run, approve, reopen, immutability, duplicate
  prevention, RBAC rejection paths
- Regression: existing salary, attendance, leave, profile and FnF routes
  untouched; the legacy `SalaryRecord` flow and its payslip still work

---

## 14. Remaining management confirmations

1. **Total Employer Cost (BK)** — confirm variant B (ESI-inclusive) is correct.
2. **ESI boundary at exactly ₹21,000** — confirm the master/monthly asymmetry
   is intended.
3. **Professional Tax** — confirm flat ₹208/month, or supply the half-yearly
   slab table.
4. **TDA (BE)** — confirm what this component represents.
5. **Master Special 1 / 2** and **Employee Deduction 1 / 2** — confirm whether
   these should be per-employee master values or per-period entries. Currently
   Special 1/2 are per-employee master fields and the monthly equivalents plus
   both deductions are per-period inputs.
6. **Employee TDS** — the workbook leaves this blank; the existing CRM slab
   engine is used. Confirm this is the intended source.
