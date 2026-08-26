import { BudgetModel } from "../../model/finance/budget-model";
import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { budgetDto } from "../../utility/dtos/finance/budget-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/budget-mapper";
import * as ledgerService from "./ledger-service";
import { getOrSet, buildCacheKey } from "../../utility/helper/cache";

const POPULATE: [string, string] = ["accountId", "code name type"];

// Same staleness/perf tradeoff as everywhere else in this pass — short TTL,
// never a source-of-truth change. Worth it here specifically since this is a
// loop of one ledger read per budgeted account, not a single aggregate call.
const CACHE_TTL_SECONDS = 30;

interface UpsertBudgetInput {
  accountId: string;
  period: string; // "YYYY-MM"
  budgetAmount: number;
}

interface BudgetResult {
  errorCode: "success" | "account_not_found" | "invalid_account_type" | "not_found";
  result: budgetDto | null;
}

// Only Revenue/Expense accounts feed P&L — budgeting an Asset/Liability/
// Equity account wouldn't have an "actual" to compare against in
// getBudgetVsActual below, so it's rejected at the source rather than
// silently accepted and shown as an always-zero row later.
const upsert = async (
  data: UpsertBudgetInput,
  scope: TenantScope,
  createdBy: string
): Promise<BudgetResult> => {
  const account = await ChartOfAccountModel.findOne({
    _id: data.accountId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  }).lean();
  if (!account) {
    return { errorCode: "account_not_found", result: null };
  }
  if (account.type !== "Revenue" && account.type !== "Expense") {
    return { errorCode: "invalid_account_type", result: null };
  }

  const budget = await BudgetModel.findOneAndUpdate(
    { accountId: data.accountId, period: data.period, adminId: scope.adminId, merchantId: scope.merchantId },
    { $set: { budgetAmount: data.budgetAmount }, $setOnInsert: { createdBy } },
    { new: true, upsert: true }
  ).populate(...POPULATE).lean();

  return { errorCode: "success", result: mapDbToDto(budget) };
};

const getAll = async (
  filter: Record<string, unknown>,
  options: { year?: string } = {}
): Promise<budgetDto[]> => {
  const query: Record<string, unknown> = {
    ...filter,
    ...(options.year ? { period: { $regex: `^${options.year}-` } } : {}),
  };
  const data = await BudgetModel.find(query).populate(...POPULATE).sort({ period: 1 }).lean();
  return mapDbListToDtoList(data);
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<BudgetResult> => {
  const budget = await BudgetModel.findOne({ _id: id, ...filter }).populate(...POPULATE).lean();
  if (!budget) {
    return { errorCode: "not_found", result: null };
  }
  await BudgetModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(budget) };
};

export interface BudgetVsActualMonth {
  month: number; // 1-12
  budget: number;
  actual: number;
}

export interface BudgetVsActualRow {
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  budgetAnnual: number;
  actualAnnual: number;
  months: BudgetVsActualMonth[];
}

// Joins Budget rows for the year against the same accounts' real ledger
// activity for that year, bucketed by month — one ledger read per budgeted
// account (not one per account per month) since getByAccount already
// returns every line with its own date.
const getBudgetVsActual = async (
  filter: Record<string, unknown>,
  year: string
): Promise<{ year: string; rows: BudgetVsActualRow[] }> =>
  getOrSet(buildCacheKey("budget:getBudgetVsActual", filter, year), CACHE_TTL_SECONDS, () =>
    getBudgetVsActualImpl(filter, year)
  );

const getBudgetVsActualImpl = async (
  filter: Record<string, unknown>,
  year: string
): Promise<{ year: string; rows: BudgetVsActualRow[] }> => {
  const budgets = await BudgetModel.find({ ...filter, period: { $regex: `^${year}-` } }).populate(...POPULATE).lean();

  const byAccount = new Map<string, { account: { code: string | null; name: string | null; type: string | null }; budgetByMonth: number[] }>();
  for (const b of budgets) {
    const account = b.accountId as any;
    const accountId = account?._id ? String(account._id) : String(b.accountId);
    if (!byAccount.has(accountId)) {
      byAccount.set(accountId, {
        account: { code: account?.code || null, name: account?.name || null, type: account?.type || null },
        budgetByMonth: new Array(12).fill(0),
      });
    }
    const monthIndex = Number((b.period || "").split("-")[1] || 0) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      byAccount.get(accountId)!.budgetByMonth[monthIndex] = b.budgetAmount || 0;
    }
  }

  const rows: BudgetVsActualRow[] = [];
  for (const [accountId, { account, budgetByMonth }] of byAccount) {
    const { lines } = await ledgerService.getByAccount(accountId, filter, {
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
    });
    const debitNormal = account.type === "Asset" || account.type === "Expense";
    const actualByMonth = new Array(12).fill(0);
    for (const line of lines) {
      if (!line.date) continue;
      const monthIndex = new Date(line.date).getUTCMonth();
      const delta = debitNormal ? (line.debit || 0) - (line.credit || 0) : (line.credit || 0) - (line.debit || 0);
      actualByMonth[monthIndex] += delta;
    }

    const months: BudgetVsActualMonth[] = budgetByMonth.map((budget, i) => ({
      month: i + 1,
      budget,
      actual: actualByMonth[i],
    }));

    rows.push({
      accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      budgetAnnual: budgetByMonth.reduce((s, v) => s + v, 0),
      actualAnnual: actualByMonth.reduce((s, v) => s + v, 0),
      months,
    });
  }

  rows.sort((a, b) => (a.accountCode || "").localeCompare(b.accountCode || ""));

  return { year, rows };
};

export { upsert, getAll, deleteByID, getBudgetVsActual };
