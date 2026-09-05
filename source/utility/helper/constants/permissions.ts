import { AccountRole } from "./enum";

// ─────────────────────────────────────────────────────────────────────────────
// Permission catalog — the single source of truth for what a sub-user's Role
// can grant. Keys are readable dot-strings shared verbatim with every
// frontend's `global/rafeeqiRoles.js`. The Account owner (super_admin / admin
// / merchant) is the "default user" and implicitly holds every permission —
// `requirePermission` (middleware/permission.ts) only ever inspects this list
// for a sub-user token (`isSubUser: true`).
//
// One group per business-route file. `view` gates every GET, `create` every
// POST, `edit` every PUT/PATCH, `delete` every DELETE — deviations (approvals,
// activate/deactivate, imports, dedicated `/status` endpoints) reuse the
// nearest of those four, or a module-specific `.status` key when present.
// ─────────────────────────────────────────────────────────────────────────────

const crud = (base: string) => ({
  view: `${base}.view`,
  create: `${base}.create`,
  edit: `${base}.edit`,
  delete: `${base}.delete`,
});

const viewOnly = (base: string) => ({ view: `${base}.view` });

export const PERMISSIONS = {
  // Access control
  user: crud("user"),
  role: crud("role"),

  // Platform
  dashboard: viewOnly("dashboard"),
  merchantManagement: crud("merchant-management"),
  adminManagement: crud("admin-management"),
  reports: viewOnly("reports"),
  settings: { view: "settings.view", edit: "settings.edit" },

  // HR
  employee: crud("employee"),
  department: crud("department"),
  designation: crud("designation"),
  attendance: crud("attendance"),
  attendancePolicy: crud("attendance-policy"),
  salary: crud("salary"),
  loan: { ...crud("loan"), approve: "loan.approve" },
  expense: { ...crud("expense"), approve: "expense.approve" },
  leave: { ...crud("leave"), approve: "leave.approve" },
  leaveType: crud("leave-type"),
  payrollRun: { ...crud("payroll-run"), process: "payroll-run.process" },
  specialPayment: crud("special-payment"),
  specialPaymentType: crud("special-payment-type"),
  providentFund: crud("provident-fund"),
  employeeRequest: { ...crud("employee-request"), approve: "employee-request.approve" },
  holiday: crud("holiday"),
  announcement: crud("announcement"),
  recruitment: crud("recruitment"),
  candidate: crud("candidate"),
  onboarding: crud("onboarding"),
  onboardingTemplate: crud("onboarding-template"),
  offboarding: crud("offboarding"),
  performance: crud("performance"),

  // Finance
  chartOfAccount: crud("finance-coa"),
  journal: crud("finance-journal"),
  ledger: viewOnly("finance-ledger"),
  financeReports: viewOnly("finance-reports"),
  bankAccount: crud("finance-bank"),
  vendorBill: crud("finance-payable"),
  customerInvoice: crud("finance-receivable"),
  payment: crud("finance-payment"),
  incomeEntry: crud("finance-income"),
  businessExpense: crud("finance-expense"),
  vatConfig: crud("finance-vat"),
  bankStatementLine: crud("finance-bank-statement"),
  reconciliationSession: crud("finance-reconciliation"),
  budget: crud("finance-budget"),

  // Inventory
  category: crud("inventory-category"),
  product: { ...crud("inventory-product"), import: "inventory-product.import" },
  variant: crud("inventory-variant"),
  production: crud("inventory-production"),
  openingStockImport: { view: "inventory-opening-stock.view", create: "inventory-opening-stock.create" },
  quarantineLot: crud("inventory-quarantine"),
  stockBatch: viewOnly("inventory-stock-batch"),

  // Warehouse
  warehouse: crud("warehouse"),
  stock: crud("warehouse-stock"),
  stockTransfer: crud("warehouse-transfer"),
  stockIssue: crud("warehouse-issue"),

  // Sales
  customer: crud("sales-customer"),
  saleInvoice: { ...crud("sales-invoice"), status: "sales-invoice.status" },
  quotation: { ...crud("sales-quotation"), status: "sales-quotation.status" },
  creditNote: { ...crud("sales-credit-note"), status: "sales-credit-note.status" },

  // Purchase
  supplier: crud("purchase-supplier"),
  purchaseInvoice: { ...crud("purchase-invoice"), status: "purchase-invoice.status" },
  debitNote: { ...crud("purchase-debit-note"), status: "purchase-debit-note.status" },

  // Assets
  assetCategory: crud("asset-category"),
  asset: { ...crud("asset"), import: "asset.import" },
  assetRequest: { ...crud("asset-request"), approve: "asset-request.approve" },
  assetAudit: crud("asset-audit"),

  // Analytics
  hrAnalytics: viewOnly("analytics-hr"),
  inventoryAnalytics: viewOnly("analytics-inventory"),
  salesAnalytics: viewOnly("analytics-sales"),
} as const;

// Flattened list of every permission string in the catalog.
export const ALL_PERMISSIONS: string[] = Array.from(
  new Set(
    Object.values(PERMISSIONS).flatMap((group) => Object.values(group as Record<string, string>))
  )
);

// Which permission keys each portal exposes in its Role builder. Enforcement
// itself is portal-agnostic (a key either is or isn't in the sub-user's list);
// this only trims what a portal's UI offers when building a Role.
const MERCHANT_EXCLUDES = new Set<string>([
  ...Object.values(PERMISSIONS.merchantManagement),
  ...Object.values(PERMISSIONS.adminManagement),
]);

const SUPER_ADMIN_INCLUDES = new Set<string>([
  ...Object.values(PERMISSIONS.user),
  ...Object.values(PERMISSIONS.role),
  ...Object.values(PERMISSIONS.dashboard),
  ...Object.values(PERMISSIONS.adminManagement),
  ...Object.values(PERMISSIONS.merchantManagement),
  ...Object.values(PERMISSIONS.employee),
  ...Object.values(PERMISSIONS.department),
  ...Object.values(PERMISSIONS.designation),
  ...Object.values(PERMISSIONS.asset),
  ...Object.values(PERMISSIONS.assetCategory),
  ...Object.values(PERMISSIONS.assetRequest),
  ...Object.values(PERMISSIONS.assetAudit),
  ...Object.values(PERMISSIONS.product),
  ...Object.values(PERMISSIONS.category),
  ...Object.values(PERMISSIONS.variant),
  ...Object.values(PERMISSIONS.warehouse),
  ...Object.values(PERMISSIONS.chartOfAccount),
  ...Object.values(PERMISSIONS.journal),
]);

export const PORTAL_PERMISSIONS: Record<AccountRole, string[]> = {
  [AccountRole.admin]: ALL_PERMISSIONS.filter(
    (p) => !Object.values(PERMISSIONS.adminManagement).includes(p as never)
  ),
  [AccountRole.merchant]: ALL_PERMISSIONS.filter((p) => !MERCHANT_EXCLUDES.has(p)),
  [AccountRole.super_admin]: ALL_PERMISSIONS.filter((p) => SUPER_ADMIN_INCLUDES.has(p)),
};

export const isValidPermission = (key: string): boolean => ALL_PERMISSIONS.includes(key);

// ─────────────────────────────────────────────────────────────────────────────
// Route → permission map, consumed by middleware/permission.ts's
// enforceModulePermissions (mounted once on the /api router). Keyed by the
// path prefix after `/api`; the LONGEST matching prefix wins. `base` is a
// PERMISSIONS group; the HTTP method picks the action
// (GET→view, POST→create, PUT/PATCH→edit, DELETE→delete). `viewOnly: true`
// forces every method to `.view`. Prefixes not listed here (`/auth`, `/geo`)
// need no permission — any authenticated session may call them.
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleRoutePermission {
  base: keyof typeof PERMISSIONS;
  viewOnly?: boolean;
}

export const MODULE_PERMISSION_MAP: Record<string, ModuleRoutePermission> = {
  "/user": { base: "user" },
  "/role": { base: "role" },
  "/admin": { base: "adminManagement" },
  "/merchant": { base: "merchantManagement" },

  "/department": { base: "department" },
  "/designation": { base: "designation" },
  "/employee-request": { base: "employeeRequest" },
  "/employee": { base: "employee" },
  "/salary": { base: "salary" },
  "/loan": { base: "loan" },
  "/expense": { base: "expense" },
  "/pf-policy": { base: "providentFund" },
  "/pf-account": { base: "providentFund" },
  "/pf-contribution": { base: "providentFund" },
  "/pf-withdrawal": { base: "providentFund" },
  "/attendance-policy": { base: "attendancePolicy" },
  "/attendance": { base: "attendance" },
  "/leave-type": { base: "leaveType" },
  "/leave": { base: "leave" },
  "/payroll-run": { base: "payrollRun" },
  "/special-payment-type": { base: "specialPaymentType" },
  "/special-payment": { base: "specialPayment" },
  "/holiday": { base: "holiday" },
  "/announcement": { base: "announcement" },
  "/recruitment/job": { base: "recruitment" },
  "/recruitment/candidate": { base: "candidate" },
  "/onboarding-template": { base: "onboardingTemplate" },
  "/onboarding": { base: "onboarding" },
  "/offboarding": { base: "offboarding" },
  "/performance": { base: "performance" },

  "/finance/chart-of-account": { base: "chartOfAccount" },
  "/finance/journal": { base: "journal" },
  "/finance/ledger": { base: "ledger", viewOnly: true },
  "/finance/reports": { base: "financeReports", viewOnly: true },
  "/finance/bank-account": { base: "bankAccount" },
  "/finance/vendor-bill": { base: "vendorBill" },
  "/finance/customer-invoice": { base: "customerInvoice" },
  "/finance/payment": { base: "payment" },
  "/finance/income-entry": { base: "incomeEntry" },
  "/finance/business-expense": { base: "businessExpense" },
  "/finance/vat-config": { base: "vatConfig" },
  "/finance/bank-statement-line": { base: "bankStatementLine" },
  "/finance/reconciliation-session": { base: "reconciliationSession" },
  "/finance/budget": { base: "budget" },

  "/asset-category": { base: "assetCategory" },
  "/asset-request": { base: "assetRequest" },
  "/asset-audit": { base: "assetAudit" },
  "/asset": { base: "asset" },

  "/analytics/hr": { base: "hrAnalytics", viewOnly: true },
  "/analytics/inventory": { base: "inventoryAnalytics", viewOnly: true },
  "/analytics/sales": { base: "salesAnalytics", viewOnly: true },

  "/inventory/category": { base: "category" },
  "/inventory/product": { base: "product" },
  "/inventory/variant": { base: "variant" },
  "/inventory/production": { base: "production" },
  "/inventory/opening-stock-import": { base: "openingStockImport" },
  "/inventory/quarantine-lot": { base: "quarantineLot" },
  "/inventory/stock-batch": { base: "stockBatch", viewOnly: true },
  "/inventory/stock": { base: "stock" },

  "/warehouse/warehouse": { base: "warehouse" },
  "/warehouse/stock-transfer": { base: "stockTransfer" },
  "/warehouse/stock-issue": { base: "stockIssue" },

  "/sales/customer": { base: "customer" },
  "/sales/sale-invoice": { base: "saleInvoice" },
  "/sales/quotation": { base: "quotation" },
  "/sales/credit-note": { base: "creditNote" },

  "/purchase/supplier": { base: "supplier" },
  "/purchase/purchase-invoice": { base: "purchaseInvoice" },
  "/purchase/debit-note": { base: "debitNote" },
};

const METHOD_ACTION: Record<string, "view" | "create" | "edit" | "delete"> = {
  GET: "view",
  POST: "create",
  PUT: "edit",
  PATCH: "edit",
  DELETE: "delete",
};

// Returns the permission key required for `method path` (path already stripped
// of the `/api` prefix + query), or null when the route needs no permission.
export const permissionForRoute = (method: string, path: string): string | null => {
  // The role picker on the Add/Edit User form is reachable by anyone who can
  // create or edit users, not only role-viewers — its own route handler makes
  // that call (requirePermission(role.view, user.create, user.edit)), so the
  // blanket gate must not pre-empt it with a stricter role.view check.
  if (path === "/role/active") return null;

  const match = Object.keys(MODULE_PERMISSION_MAP)
    .filter((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) return null;

  const entry = MODULE_PERMISSION_MAP[match];
  const group = PERMISSIONS[entry.base] as Record<string, string>;

  // Dedicated status endpoints (…/status, …/delivery-status) use `.status`
  // when the module defines one; otherwise they fall back to `.edit`.
  const isStatusPath =
    /\/delivery-status(\/|$)/.test(path) || /\/status(\/|$)/.test(path);
  if (isStatusPath && method.toUpperCase() === "PATCH") {
    return group.status || group.edit || group.view || null;
  }

  const action = entry.viewOnly ? "view" : METHOD_ACTION[method.toUpperCase()] || "view";
  return group[action] || group.view || null;
};
