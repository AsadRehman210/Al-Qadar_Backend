import mongoose from "mongoose";
import { BankAccountModel } from "../../model/finance/bank-account-model";
import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { LedgerLineModel } from "../../model/finance/ledger-line-model";
import { TenantScope, toAggregateFilter } from "../../utility/helper/tenant-scope";
import { bankAccountDto } from "../../utility/dtos/finance/bank-account-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/bank-account-mapper";
import { buildSearchCondition } from "../../utility/helper/list-query";
import { createJournalEntry } from "./journal-service";

export interface BankAccountListOptions {
  search?: string;
  status?: string;
}

interface CreateBankAccountInput {
  name: string;
  bankName?: string;
  accountNumber?: string;
  type: "Bank" | "Cash";
  currency?: string;
  openingBalance?: number;
}

interface BankAccountResult {
  errorCode: "success" | "not_found";
  result: bankAccountDto | null;
}

// Every bank/cash account gets its own backing Chart-of-Account entry (Asset,
// current_asset) — deposits/withdrawals post against this code through the
// same journal-service engine every other module uses, so the balance is
// never stored separately from the ledger.
const create = async (
  data: CreateBankAccountInput,
  scope: TenantScope,
  createdBy: string
): Promise<BankAccountResult> => {
  const code = `BK${String(Date.now()).slice(-8)}`;
  const chartAccount = await ChartOfAccountModel.create({
    code,
    name: data.name,
    type: "Asset",
    subType: "current_asset",
    parentId: null,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  const bankAccount = await BankAccountModel.create({
    name: data.name,
    bankName: data.bankName || null,
    accountNumber: data.accountNumber || null,
    type: data.type,
    currency: data.currency || "SAR",
    chartAccountId: chartAccount._id,
    openingBalance: data.openingBalance || 0,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  if (data.openingBalance) {
    // Retained Earnings (seed code "3000") is the contra side for an opening
    // balance — every tenant has it via seedDefaultChartOfAccounts, so this
    // always resolves in practice.
    const retainedEarnings = await ChartOfAccountModel.findOne({
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      code: "3000",
    }).lean();
    if (retainedEarnings) {
      await createJournalEntry({
        tenant: scope,
        createdBy,
        date: new Date(),
        memo: `Opening balance — ${data.name}`,
        lines: [
          { accountId: String(chartAccount._id), debit: data.openingBalance, credit: 0 },
          { accountId: String(retainedEarnings._id), debit: 0, credit: data.openingBalance },
        ],
      });
    }
  }

  return { errorCode: "success", result: mapDbToDto(bankAccount, data.openingBalance || 0) };
};

// `chartAccountId` may be a populated ChartOfAccount doc or a raw ObjectId
// depending on whether the caller populated it — always resolve to the
// real id string before using it as a map/query key.
const rawChartAccountId = (doc: { chartAccountId?: unknown }): string => {
  const value = doc.chartAccountId as { _id?: unknown } | null;
  if (value && typeof value === "object" && "_id" in value) return String(value._id);
  return String(value);
};

const balancesByChartAccountIds = async (
  filter: Record<string, unknown>,
  chartAccountIds: string[]
): Promise<Map<string, number>> => {
  if (!chartAccountIds.length) return new Map();
  const match = { ...toAggregateFilter(filter), accountId: { $in: chartAccountIds.map((id) => new mongoose.Types.ObjectId(id)) } };
  const grouped = await LedgerLineModel.aggregate([
    { $match: match },
    { $group: { _id: "$accountId", totalDebit: { $sum: "$debit" }, totalCredit: { $sum: "$credit" } } },
  ]);
  const map = new Map<string, number>();
  grouped.forEach((g) => map.set(String(g._id), (g.totalDebit || 0) - (g.totalCredit || 0)));
  return map;
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: BankAccountListOptions = {}
): Promise<{ totalCount: number; result: bankAccountDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["name", "bankName", "accountNumber"]),
    ...(options.status ? { status: options.status } : {}),
  };

  const data = await BankAccountModel.find(query)
    .populate("chartAccountId", "code")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await BankAccountModel.countDocuments(query);

  const balances = await balancesByChartAccountIds(
    filter,
    data.map((d) => rawChartAccountId(d))
  );

  return { totalCount: count, result: mapDbListToDtoList(data, balances) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<bankAccountDto | null> => {
  const data = await BankAccountModel.findOne({ _id: id, ...filter }).populate("chartAccountId", "code").lean();
  if (!data) return null;
  const balances = await balancesByChartAccountIds(filter, [rawChartAccountId(data)]);
  return mapDbToDto(data, balances.get(rawChartAccountId(data)) || 0);
};

const update = async (
  id: string,
  data: { name?: string; bankName?: string; accountNumber?: string; status?: string },
  filter: Record<string, unknown>
): Promise<BankAccountResult> => {
  const updatePayload: Record<string, unknown> = {};
  if (data.name) updatePayload.name = data.name;
  if (data.bankName !== undefined) updatePayload.bankName = data.bankName;
  if (data.accountNumber !== undefined) updatePayload.accountNumber = data.accountNumber;
  if (data.status) updatePayload.status = data.status;

  const updated = await BankAccountModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: updatePayload },
    { new: true }
  ).populate("chartAccountId", "code").lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  const balances = await balancesByChartAccountIds(filter, [rawChartAccountId(updated)]);
  return { errorCode: "success", result: mapDbToDto(updated, balances.get(rawChartAccountId(updated)) || 0) };
};

interface PostEntryInput {
  date: Date;
  type: "deposit" | "withdrawal" | "bank_charge";
  amount: number;
  contraAccountId: string;
  description?: string;
  reference?: string;
}

interface PostEntryResult {
  errorCode: "success" | "not_found";
}

// A deposit debits the bank/cash account (asset increases) and credits
// whatever the money came from; a withdrawal or bank charge is the mirror —
// both are just a 2-line manual entry through the same createJournalEntry
// engine every other Finance/HR posting shares.
const postEntry = async (
  id: string,
  input: PostEntryInput,
  scope: TenantScope,
  createdBy: string
): Promise<PostEntryResult> => {
  const bankAccount = await BankAccountModel.findOne({ _id: id, adminId: scope.adminId, merchantId: scope.merchantId }).lean();
  if (!bankAccount) {
    return { errorCode: "not_found" };
  }

  const bankChartAccountId = String(bankAccount.chartAccountId);
  const isInflow = input.type === "deposit";

  await createJournalEntry({
    tenant: scope,
    createdBy,
    date: input.date,
    memo: input.description || undefined,
    lines: [
      {
        accountId: isInflow ? bankChartAccountId : input.contraAccountId,
        debit: input.amount,
        credit: 0,
      },
      {
        accountId: isInflow ? input.contraAccountId : bankChartAccountId,
        debit: 0,
        credit: input.amount,
      },
    ],
  });

  return { errorCode: "success" };
};

export { create, getAll, get, update, postEntry };
