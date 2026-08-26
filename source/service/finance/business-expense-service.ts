import { BusinessExpenseModel } from "../../model/finance/business-expense-model";
import { BankAccountModel } from "../../model/finance/bank-account-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { businessExpenseDto } from "../../utility/dtos/finance/business-expense-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/business-expense-mapper";
import { buildSearchCondition } from "../../utility/helper/list-query";
import { createJournalEntry } from "./journal-service";

export interface BusinessExpenseListOptions {
  search?: string;
  fromDate?: string;
  toDate?: string;
}

interface CreateBusinessExpenseInput {
  date: string;
  category: string;
  description?: string;
  amount: number;
  currency?: string;
  bankAccountId: string;
  expenseAccountId: string;
}

interface BusinessExpenseResult {
  errorCode: "success" | "not_found";
  result: businessExpenseDto | null;
}

// A business expense paid straight from Bank/Cash that doesn't need a formal
// Vendor Bill — Debit Expense, Credit Bank, posted immediately through the
// same journal-service engine every other Finance/HR posting shares.
const create = async (
  data: CreateBusinessExpenseInput,
  scope: TenantScope,
  createdBy: string
): Promise<BusinessExpenseResult> => {
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
    memo: data.description || data.category,
    lines: [
      { accountId: data.expenseAccountId, debit: data.amount, credit: 0 },
      { accountId: String(bankAccount.chartAccountId), debit: 0, credit: data.amount },
    ],
  });

  const entry = await BusinessExpenseModel.create({
    date: new Date(data.date),
    category: data.category,
    description: data.description || null,
    amount: data.amount,
    currency: data.currency || "SAR",
    bankAccountId: bankAccount._id,
    expenseAccountId: data.expenseAccountId,
    journalEntryId: journal._id,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await entry.populate("bankAccountId", "name");
  await entry.populate("expenseAccountId", "code name");

  return { errorCode: "success", result: mapDbToDto(entry) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: BusinessExpenseListOptions = {}
): Promise<{ totalCount: number; result: businessExpenseDto[] }> => {
  const startIndex = (page - 1) * limit;
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);

  const query: Record<string, unknown> = {
    ...filter,
    ...buildSearchCondition(options.search, ["category", "description"]),
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  const data = await BusinessExpenseModel.find(query)
    .populate("bankAccountId", "name")
    .populate("expenseAccountId", "code name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await BusinessExpenseModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<businessExpenseDto | null> => {
  const data = await BusinessExpenseModel.findOne({ _id: id, ...filter })
    .populate("bankAccountId", "name")
    .populate("expenseAccountId", "code name")
    .lean();
  return data ? mapDbToDto(data) : null;
};

export { create, getAll, get };
