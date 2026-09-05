import { ChartOfAccountType } from "../../model/finance/chart-of-account-model";

export interface DefaultAccountSeed {
  code: string;
  name: string;
  type: ChartOfAccountType;
  subType: string;
}

// Seeded once for every new Admin/Merchant tenant (see chart-of-account-service.ts)
// so Loan/Expense/Provident Fund postings always have a valid target account
// without requiring manual Chart of Accounts setup first.
export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountSeed[] = [
  { code: "1000", name: "Cash on Hand", type: "Asset", subType: "current_asset" },
  { code: "1010", name: "Bank - Main", type: "Asset", subType: "current_asset" },
  { code: "1100", name: "Accounts Receivable", type: "Asset", subType: "current_asset" },
  { code: "1150", name: "VAT Receivable", type: "Asset", subType: "vat_receivable" },
  { code: "1200", name: "Employee Loans Receivable", type: "Asset", subType: "current_asset" },
  { code: "1300", name: "Inventory", type: "Asset", subType: "current_asset" },
  { code: "1500", name: "Fixed Assets", type: "Asset", subType: "fixed_asset" },
  { code: "1510", name: "Accumulated Depreciation", type: "Asset", subType: "contra_asset" },
  { code: "2000", name: "Accounts Payable", type: "Liability", subType: "current_liability" },
  { code: "2050", name: "VAT Payable", type: "Liability", subType: "vat_payable" },
  { code: "2100", name: "Provident Fund Payable", type: "Liability", subType: "current_liability" },
  { code: "2200", name: "Salaries Payable", type: "Liability", subType: "current_liability" },
  { code: "3000", name: "Retained Earnings", type: "Equity", subType: "retained_earnings" },
  { code: "4000", name: "Operating Revenue", type: "Revenue", subType: "operating_revenue" },
  { code: "4100", name: "Gain on Disposal of Asset", type: "Revenue", subType: "other_income" },
  { code: "5000", name: "Salaries & Wages Expense", type: "Expense", subType: "operating_expense" },
  { code: "5300", name: "Cost of Goods Sold", type: "Expense", subType: "cost_of_goods_sold" },
  { code: "5100", name: "Provident Fund Expense", type: "Expense", subType: "operating_expense" },
  { code: "5200", name: "Travel & Transportation Expense", type: "Expense", subType: "operating_expense" },
  { code: "5210", name: "Office & Admin Expense", type: "Expense", subType: "operating_expense" },
  { code: "5220", name: "Client Entertainment Expense", type: "Expense", subType: "operating_expense" },
  { code: "5230", name: "Training & Certification Expense", type: "Expense", subType: "operating_expense" },
  { code: "5240", name: "Bank Charges Expense", type: "Expense", subType: "operating_expense" },
  { code: "5250", name: "Utilities Expense", type: "Expense", subType: "operating_expense" },
  { code: "5290", name: "Other Operating Expense", type: "Expense", subType: "operating_expense" },
  { code: "5310", name: "Inventory Loss & Write-off Expense", type: "Expense", subType: "operating_expense" },
  { code: "5320", name: "Internal Use Expense", type: "Expense", subType: "operating_expense" },
  { code: "5330", name: "Samples & Marketing Expense", type: "Expense", subType: "operating_expense" },
  { code: "5340", name: "Manufacturing Overhead Expense", type: "Expense", subType: "operating_expense" },
  { code: "5350", name: "Loss on Disposal of Asset", type: "Expense", subType: "operating_expense" },
];

// Maps the frontend's expenseType category ids to a default account code.
// Anything not listed here falls back to DEFAULT_EXPENSE_ACCOUNT_CODE — extend
// this as more of the frontend's ~20 EXPENSE_TYPE_IDS are confirmed.
export const EXPENSE_TYPE_ACCOUNT_CODE: Record<string, string> = {
  travel_transportation: "5200",
  office_supplies: "5210",
  client_entertainment: "5220",
  training_certification: "5230",
  bank_charges: "5240",
  utilities: "5250",
};

export const DEFAULT_EXPENSE_ACCOUNT_CODE = "5290";
