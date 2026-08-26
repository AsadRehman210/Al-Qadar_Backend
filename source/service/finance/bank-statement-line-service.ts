import { BankStatementLineModel } from "../../model/finance/bank-statement-line-model";
import { BankAccountModel } from "../../model/finance/bank-account-model";
import { LedgerLineModel } from "../../model/finance/ledger-line-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { bankStatementLineDto } from "../../utility/dtos/finance/bank-statement-line-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/bank-statement-line-mapper";

export interface BankStatementLineListOptions {
  bankAccountId?: string;
  matched?: string;
}

interface CreateBankStatementLineInput {
  bankAccountId: string;
  date: string;
  description?: string;
  amount: number;
  reference?: string;
}

interface BankStatementLineResult {
  errorCode: "success" | "not_found";
  result: bankStatementLineDto | null;
}

const create = async (
  data: CreateBankStatementLineInput,
  scope: TenantScope,
  createdBy: string
): Promise<BankStatementLineResult> => {
  const bankAccount = await BankAccountModel.findOne({
    _id: data.bankAccountId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  }).lean();
  if (!bankAccount) {
    return { errorCode: "not_found", result: null };
  }

  const line = await BankStatementLineModel.create({
    bankAccountId: bankAccount._id,
    date: new Date(data.date),
    description: data.description || null,
    amount: data.amount,
    reference: data.reference || null,
    matched: false,
    matchedLedgerLineId: null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(line) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: BankStatementLineListOptions = {}
): Promise<{ totalCount: number; result: bankStatementLineDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    ...filter,
    ...(options.bankAccountId ? { bankAccountId: options.bankAccountId } : {}),
    ...(options.matched !== undefined ? { matched: options.matched === "true" } : {}),
  };

  const data = await BankStatementLineModel.find(query)
    .skip(startIndex)
    .limit(limit)
    .sort({ date: -1, _id: -1 })
    .lean();
  const count = await BankStatementLineModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

// Matching just links a statement line to a real ledger line the user
// visually confirmed corresponds to it — it never creates or changes any
// ledger data, purely a checkbox on top of what already posted.
const match = async (
  id: string,
  ledgerLineId: string,
  filter: Record<string, unknown>
): Promise<BankStatementLineResult> => {
  const ledgerLine = await LedgerLineModel.findOne({ _id: ledgerLineId, ...filter }).lean();
  if (!ledgerLine) {
    return { errorCode: "not_found", result: null };
  }

  const updated = await BankStatementLineModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: { matched: true, matchedLedgerLineId: ledgerLineId } },
    { new: true }
  ).lean();
  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const unmatch = async (id: string, filter: Record<string, unknown>): Promise<BankStatementLineResult> => {
  const updated = await BankStatementLineModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: { matched: false, matchedLedgerLineId: null } },
    { new: true }
  ).lean();
  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

export { create, getAll, match, unmatch };
