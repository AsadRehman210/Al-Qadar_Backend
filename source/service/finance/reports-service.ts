import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import * as ledgerService from "./ledger-service";
import { getOrSet, buildCacheKey } from "../../utility/helper/cache";

// Same staleness/perf tradeoff as everywhere else in this pass — short TTL,
// never a source-of-truth change.
const CACHE_TTL_SECONDS = 30;

export interface ReportAccountRow {
  accountId: string;
  code: string | null;
  name: string | null;
  amount: number;
}

// Every report here is derived entirely from ledger_line — there is no
// separate writable "report" model. Re-running Trial Balance's grouped
// debit/credit sums (see ledger-service.getTrialBalance) keeps P&L/Balance
// Sheet automatically in sync with every posting, HR-driven or otherwise.
const getTrialBalance = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
) => ledgerService.getTrialBalance(filter, options);

const getProfitAndLoss = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{ revenue: ReportAccountRow[]; expenses: ReportAccountRow[]; totalRevenue: number; totalExpenses: number; netProfit: number }> => {
  const { rows } = await ledgerService.getTrialBalance(filter, options);

  const revenue: ReportAccountRow[] = rows
    .filter((r) => r.type === "Revenue")
    .map((r) => ({ accountId: r.accountId, code: r.code, name: r.name, amount: r.totalCredit - r.totalDebit }));

  const expenses: ReportAccountRow[] = rows
    .filter((r) => r.type === "Expense")
    .map((r) => ({ accountId: r.accountId, code: r.code, name: r.name, amount: r.totalDebit - r.totalCredit }));

  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum, r) => sum + r.amount, 0);

  return { revenue, expenses, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses };
};

const getBalanceSheet = async (
  filter: Record<string, unknown>,
  options: { asOfDate?: string } = {}
): Promise<{ assets: ReportAccountRow[]; liabilities: ReportAccountRow[]; equity: ReportAccountRow[]; totalAssets: number; totalLiabilities: number; totalEquity: number }> => {
  const { rows } = await ledgerService.getTrialBalance(filter, { toDate: options.asOfDate });

  const toRow = (r: (typeof rows)[number], debitNormal: boolean): ReportAccountRow => ({
    accountId: r.accountId,
    code: r.code,
    name: r.name,
    amount: debitNormal ? r.totalDebit - r.totalCredit : r.totalCredit - r.totalDebit,
  });

  const assets = rows.filter((r) => r.type === "Asset").map((r) => toRow(r, true));
  const liabilities = rows.filter((r) => r.type === "Liability").map((r) => toRow(r, false));
  const equity = rows.filter((r) => r.type === "Equity").map((r) => toRow(r, false));

  // Revenue/Expense accounts never close into Equity here (there's no
  // period-close step) — without folding the current period's net income in,
  // Assets never equals Liabilities + Equity. Add it as a synthetic
  // "Current Year Earnings" row, the standard way an unclosed accounting
  // period is shown on a Balance Sheet.
  const revenueTotal = rows.filter((r) => r.type === "Revenue").reduce((sum, r) => sum + (r.totalCredit - r.totalDebit), 0);
  const expenseTotal = rows.filter((r) => r.type === "Expense").reduce((sum, r) => sum + (r.totalDebit - r.totalCredit), 0);
  const currentYearEarnings = revenueTotal - expenseTotal;
  if (currentYearEarnings !== 0) {
    equity.push({ accountId: "current-year-earnings", code: null, name: "Current Year Earnings", amount: currentYearEarnings });
  }

  return {
    assets,
    liabilities,
    equity,
    totalAssets: assets.reduce((sum, r) => sum + r.amount, 0),
    totalLiabilities: liabilities.reduce((sum, r) => sum + r.amount, 0),
    totalEquity: equity.reduce((sum, r) => sum + r.amount, 0),
  };
};

// VAT collected (output, credited to VAT Payable "2050" when an invoice is
// sent) vs VAT paid (input, debited to VAT Receivable "1150" when a bill is
// approved) — read directly off those two ledger accounts for the period,
// same derived-report pattern as Trial Balance/P&L/Balance Sheet.
const getVatSummary = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{ outputVat: number; inputVat: number; netVat: number }> => {
  const { rows } = await ledgerService.getTrialBalance(filter, options);

  const vatPayable = rows.find((r) => r.code === "2050");
  const vatReceivable = rows.find((r) => r.code === "1150");

  const outputVat = vatPayable ? vatPayable.totalCredit - vatPayable.totalDebit : 0;
  const inputVat = vatReceivable ? vatReceivable.totalDebit - vatReceivable.totalCredit : 0;

  return { outputVat, inputVat, netVat: outputVat - inputVat };
};

// Categorizes a Cash/Bank ledger line by the memo every journal-posting call
// site in this app already writes — every real cash-moving transaction
// (Sale/Purchase payment, Sale/Purchase refund) has a distinct, consistent
// prefix, so this needs no separate "category" field anywhere.
const CASH_FLOW_CATEGORIES: { label: string; test: (source: string) => boolean }[] = [
  { label: "Customer Collections", test: (s) => s.startsWith("Payment received") },
  { label: "Supplier Payments", test: (s) => s.startsWith("Payment sent") },
  { label: "Refunds Received (from Suppliers)", test: (s) => s.startsWith("Refund received") },
  { label: "Refunds Paid (to Customers)", test: (s) => s.startsWith("Refund paid") },
];

export interface CashFlowCategoryRow {
  label: string;
  in: number;
  out: number;
  net: number;
}

// Only Operating activities are ever real here — this app has no concept of
// Investing (fixed-asset purchases) or Financing (loans, owner equity) cash
// movements anywhere in the ledger, so a fake Investing/Financing section
// that's always zero would be less honest than just not showing one.
const getCashFlow = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{
  openingBalance: number;
  closingBalance: number;
  totalIn: number;
  totalOut: number;
  netChange: number;
  categories: CashFlowCategoryRow[];
}> =>
  getOrSet(buildCacheKey("reports:getCashFlow", filter, options), CACHE_TTL_SECONDS, () => getCashFlowImpl(filter, options));

const getCashFlowImpl = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{
  openingBalance: number;
  closingBalance: number;
  totalIn: number;
  totalOut: number;
  netChange: number;
  categories: CashFlowCategoryRow[];
}> => {
  const cashAccounts = await ChartOfAccountModel.find({ ...filter, code: { $in: ["1000", "1010"] } }).lean();

  let openingBalance = 0;
  let closingBalance = 0;
  const allLines: { debit: number; credit: number; source: string | null }[] = [];

  for (const account of cashAccounts) {
    const { openingBalance: ob, lines, closingBalance: cb } = await ledgerService.getByAccount(
      String(account._id),
      filter,
      options
    );
    openingBalance += ob;
    closingBalance += cb;
    for (const line of lines) allLines.push({ debit: line.debit || 0, credit: line.credit || 0, source: line.source || null });
  }

  const byCategory = new Map<string, { in: number; out: number }>();
  let totalIn = 0;
  let totalOut = 0;
  for (const line of allLines) {
    const match = CASH_FLOW_CATEGORIES.find((c) => line.source && c.test(line.source));
    const label = match ? match.label : "Other";
    const entry = byCategory.get(label) || { in: 0, out: 0 };
    entry.in += line.debit;
    entry.out += line.credit;
    byCategory.set(label, entry);
    totalIn += line.debit;
    totalOut += line.credit;
  }

  const categories: CashFlowCategoryRow[] = Array.from(byCategory.entries())
    .map(([label, v]) => ({ label, in: v.in, out: v.out, net: v.in - v.out }))
    .sort((a, b) => b.in + b.out - (a.in + a.out));

  return { openingBalance, closingBalance, totalIn, totalOut, netChange: totalIn - totalOut, categories };
};

export { getTrialBalance, getProfitAndLoss, getBalanceSheet, getVatSummary, getCashFlow };
