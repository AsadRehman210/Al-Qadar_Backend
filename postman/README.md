# Al-Qadar ERP — Postman Collection

Complete end-to-end test collection for the backend in `D:\start\backend`, covering every module built so far: Auth, Admin/Merchant Management, Department, Designation, Shift, Employee, Salary, Loan, Expense, Provident Fund, Attendance — with the underlying Finance postings triggered automatically where applicable (Loan disbursement/repayment, Expense reimbursement, PF contribution/withdrawal).

## Setup

1. **Start MongoDB** and make sure `D:\start\backend\.env` points `DB_ADDRESS` at it.
2. **Seed the one Super Admin account** (only needs doing once):
   ```
   cd D:\start\backend
   yarn seed:super-admin
   ```
   This uses `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` from `.env`.
3. **Start the server**:
   ```
   yarn start
   ```
   It listens on `PORT` from `.env` (default `3001`).
4. In Postman: **Import** both files in this folder —
   - `Al-Qadar-ERP.postman_collection.json`
   - `Al-Qadar-ERP.postman_environment.json`
5. Select the **"Al-Qadar ERP - Local"** environment (top-right dropdown in Postman) before running anything.
6. Open the environment and set `superAdminEmail`/`superAdminPassword` to match whatever you put in `.env` when seeding, if you changed them from the defaults.

## Running it

The collection is ordered so it can be run **top to bottom** via Postman's **Collection Runner**, folder by folder:

`00 Auth → 01 Admin → 02 Merchant → 03 Department → 04 Designation → 05 Shift → 06 Employee → 07 Salary → 08 Loan → 09 Expense → 10 Provident Fund → 11 Attendance`

Each "Create"/"Login" request has a small test script that automatically saves the id/token it returns into the environment (e.g. `employeeId`, `adminToken`) — every later request reads those back out, so nothing needs to be copy-pasted by hand. Requests prefixed `[Alt]` (e.g. "[Alt] Manager Reject") are **alternative** examples of a rejection/failure path — they're not meant to run back-to-back with the approval right above them (an already-approved/rejected record will just return a "wrong status" error if you run both, which is expected, not a bug).

The final folder, **`99 - Cleanup`**, is **not** part of the main flow — it holds the delete/soft-delete endpoints for Department/Designation/Shift/Employee/Attendance. Run it manually, and only after you're done exercising everything above, since Designation/Employee/Salary/etc. all depend on the Department/Designation/Shift records created earlier.

## What to look at while testing

- **Finance integration**: after "Disburse Loan", "Record Repayment", "Mark Reimbursed" (Expense), "Post Monthly Contribution", or "Mark Withdrawal Paid" (PF Withdrawal), a `JournalEntry` + two `LedgerLine`s were posted behind the scenes — there's no dedicated GET endpoint for these yet (out of scope for this build), so verify them directly in MongoDB (`journal_entry` / `ledger_line` collections) if you want to confirm the accounting side.
- **Tenant isolation**: run "List Employees (own scope, default)" as the Admin — it returns only the Admin's own direct employees. Then run "List Employees (Admin drilling into one Merchant)" with `?merchantId={{merchantId}}` — same Admin token, but now scoped to just that Merchant's employees. Try logging in as the Merchant itself (`Login - Merchant`) and hitting `GET {{baseUrl}}/employee` with `{{merchantToken}}` — it will only ever see its own.
- **Super Admin is read-only on operational data**: every write endpoint (Employee, Loan, Expense, etc.) is `admin`/`merchant` only. If you swap the bearer token on any "Create"/action request to `{{superAdminToken}}`, expect a "not authorized" response — that's the intended access-control policy, not a bug.
