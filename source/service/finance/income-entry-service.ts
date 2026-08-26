import { IncomeEntryModel } from "../../model/finance/income-entry-model";
import { BankAccountModel } from "../../model/finance/bank-account-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { incomeEntryDto } from "../../utility/dtos/finance/income-entry-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/income-entry-mapper";
import { buildSearchCondition } from "../../utility/helper/list-query";
import { createJournalEntry } from "./journal-service";

export interface IncomeEntryListOptions {
  search?: string;
  fromDate?: string;
  toDate?: string;
}

interface CreateIncomeEntryInput {
  date: string;
  source: string;
  description?: string;
  amount: number;
  currency?: string;
  bankAccountId: string;
  revenueAccountId: string;
}

interface IncomeEntryResult {
  errorCode: "success" | "not_found";
  result: incomeEntryDto | null;
}

// Misc revenue that doesn't need a formal Customer Invoice — Debit Bank,
// Credit Revenue, posted immediately through the same journal-service engine
// every other Finance/HR posting shares.
const create = async (
  data: CreateIncomeEntryInput,
  scope: TenantScope,
  createdBy: string
): Promise<IncomeEntryResult> => {
  const bankAccount = await BankAccountModel.findOne({
    _id: data.bankAccountId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  }).lean();
  if (!bankAccount) {
    return { errorCode: "not_found", result: null };
  }

  const journal = await createJournalEntry({
    tenant: scope,
    createdBy,
    date: new Date(data.date),
    memo: data.description || data.source,
    lines: [
      { accountId: String(bankAccount.chartAccountId), debit: data.amount, credit: 0 },
      { accountId: data.revenueAccountId, debit: 0, credit: data.amount },
    ],
  });

  const entry = await IncomeEntryModel.create({
    date: new Date(data.date),
    source: data.source,
    description: data.description || null,
    amount: data.amount,
    currency: data.currency || "SAR",
    bankAccountId: bankAccount._id,
    revenueAccountId: data.revenueAccountId,
    journalEntryId: journal._id,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await entry.populate("bankAccountId", "name");
  await entry.populate("revenueAccountId", "code name");

  return { errorCode: "success", result: mapDbToDto(entry) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: IncomeEntryListOptions = {}
): Promise<{ totalCount: number; result: incomeEntryDto[] }> => {
  const startIndex = (page - 1) * limit;
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);

  const query: Record<string, unknown> = {
    ...filter,
    ...buildSearchCondition(options.search, ["source", "description"]),
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  const data = await IncomeEntryModel.find(query)
    .populate("bankAccountId", "name")
    .populate("revenueAccountId", "code name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await IncomeEntryModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<incomeEntryDto | null> => {
  const data = await IncomeEntryModel.findOne({ _id: id, ...filter })
    .populate("bankAccountId", "name")
    .populate("revenueAccountId", "code name")
    .lean();
  return data ? mapDbToDto(data) : null;
};

export { create, getAll, get };
