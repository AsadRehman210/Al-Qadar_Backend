import { LedgerLineModel } from "../../model/finance/ledger-line-model";
import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { ledgerLineDto } from "../../utility/dtos/finance/ledger-line-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/ledger-line-mapper";
import { toAggregateFilter } from "../../utility/helper/tenant-scope";
import { getOrSet, buildCacheKey } from "../../utility/helper/cache";

// Trial Balance is the single shared aggregation every other Finance report
// (P&L, Balance Sheet, VAT Summary) re-derives from — Dashboard/Reports can
// end up calling it several times in one load with the same tenant+range.
// Short TTL so it's a staleness/perf tradeoff, never a source-of-truth change.
const CACHE_TTL_SECONDS = 30;

export interface LedgerListOptions {
  accountId?: string;
  source?: string;
  fromDate?: string;
  toDate?: string;
}

// `toDate` is a calendar day, not a timestamp — a plain `new Date(toDate)`
// lands on that day's midnight, so a $lte against it would silently exclude
// every posting made later that same day. Push it to the end of the day so
// "through Aug 2" actually includes all of Aug 2.
const buildDateFilter = (fromDate?: string, toDate?: string): Record<string, unknown> => {
  const dateFilter: Record<string, unknown> = {};
  if (fromDate) dateFilter.$gte = new Date(fromDate);
  if (toDate) {
    const endOfDay = new Date(toDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    dateFilter.$lte = endOfDay;
  }
  return Object.keys(dateFilter).length ? { date: dateFilter } : {};
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: LedgerListOptions = {}
): Promise<{ totalCount: number; result: ledgerLineDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    ...filter,
    ...(options.accountId ? { accountId: options.accountId } : {}),
    ...(options.source ? { source: options.source } : {}),
    ...buildDateFilter(options.fromDate, options.toDate),
  };

  // createdAt, not date — `date` is each source module's own business date
  // (some post the exact creation timestamp, others truncate to that day's
  // midnight, e.g. Sale Invoice), so it's inconsistent across sources and
  // can't be trusted to reflect real posting order. createdAt is a plain
  // Mongoose timestamp on every line regardless of source, so "latest
  // posted first" always matches what actually happened.
  const data = await LedgerLineModel.find(query)
    .populate("accountId", "code name type")
    .skip(startIndex)
    .limit(limit)
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  const count = await LedgerLineModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

// Debit-normal accounts (Asset/Expense) accumulate balance as debit-credit;
// credit-normal accounts (Liability/Equity/Revenue) accumulate the opposite —
// this matches how a statement/ledger card is conventionally read, rather
// than showing a liability's balance as a confusing negative number.
const isDebitNormal = (type?: string | null): boolean => type === "Asset" || type === "Expense";

const getByAccount = async (
  accountId: string,
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{ account: { id: string; code: string | null; name: string | null; type: string | null } | null; openingBalance: number; lines: ledgerLineDto[]; closingBalance: number }> => {
  const account = await ChartOfAccountModel.findOne({ _id: accountId, ...filter }).lean();
  if (!account) {
    return { account: null, openingBalance: 0, lines: [], closingBalance: 0 };
  }
  const debitNormal = isDebitNormal(account.type);

  let openingBalance = 0;
  if (options.fromDate) {
    const priorLines = await LedgerLineModel.find({
      ...filter,
      accountId,
      date: { $lt: new Date(options.fromDate) },
    }).lean();
    openingBalance = priorLines.reduce((bal, line) => {
      const delta = debitNormal ? (line.debit || 0) - (line.credit || 0) : (line.credit || 0) - (line.debit || 0);
      return bal + delta;
    }, 0);
  }

  const query: Record<string, unknown> = { ...filter, accountId, ...buildDateFilter(options.fromDate, options.toDate) };
  const rawLines = await LedgerLineModel.find(query)
    .populate("accountId", "code name type")
    .sort({ date: 1, _id: 1 })
    .lean();

  let running = openingBalance;
  const lines = rawLines.map((line) => {
    const delta = debitNormal ? (line.debit || 0) - (line.credit || 0) : (line.credit || 0) - (line.debit || 0);
    running += delta;
    return mapDbToDto(line, running);
  });

  return {
    account: { id: String(account._id), code: account.code || null, name: account.name || null, type: account.type || null },
    openingBalance,
    lines,
    closingBalance: running,
  };
};

export interface TrialBalanceRow {
  accountId: string;
  code: string | null;
  name: string | null;
  type: string | null;
  totalDebit: number;
  totalCredit: number;
}

const getTrialBalance = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }> =>
  getOrSet(buildCacheKey("ledger:getTrialBalance", filter, options), CACHE_TTL_SECONDS, () =>
    getTrialBalanceImpl(filter, options)
  );

const getTrialBalanceImpl = async (
  filter: Record<string, unknown>,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }> => {
  const match = { ...toAggregateFilter(filter), ...buildDateFilter(options.fromDate, options.toDate) };

  const grouped = await LedgerLineModel.aggregate([
    { $match: match },
    { $group: { _id: "$accountId", totalDebit: { $sum: "$debit" }, totalCredit: { $sum: "$credit" } } },
  ]);

  if (!grouped.length) {
    return { rows: [], totalDebit: 0, totalCredit: 0 };
  }

  const accounts = await ChartOfAccountModel.find({ _id: { $in: grouped.map((g) => g._id) } }).lean();
  const accountById = new Map(accounts.map((a) => [String(a._id), a]));

  const rows: TrialBalanceRow[] = grouped
    .map((g) => {
      const account = accountById.get(String(g._id));
      return {
        accountId: String(g._id),
        code: account?.code || null,
        name: account?.name || null,
        type: account?.type || null,
        totalDebit: g.totalDebit || 0,
        totalCredit: g.totalCredit || 0,
      };
    })
    .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  return {
    rows,
    totalDebit: rows.reduce((sum, r) => sum + r.totalDebit, 0),
    totalCredit: rows.reduce((sum, r) => sum + r.totalCredit, 0),
  };
};

export { getAll, getByAccount, getTrialBalance, isDebitNormal };
