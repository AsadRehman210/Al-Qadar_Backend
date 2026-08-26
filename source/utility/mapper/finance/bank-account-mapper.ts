import { bankAccountDto } from "../../dtos/finance/bank-account-dto";
import { IBankAccountModel } from "../../../model/finance/bank-account-model";

// `currentBalance` is always supplied by the service (derived from summing
// ledger_line for this account's chartAccountId) — never read off the model
// itself, since the model never stores a balance.
const mapDbToDto = (dbModel: IBankAccountModel, currentBalance = 0): bankAccountDto => {
  const chartAccount = dbModel.chartAccountId as unknown as Record<string, unknown> | null;
  const isPopulated = chartAccount && typeof chartAccount === "object" && "code" in chartAccount;
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    name: dbModel.name || null,
    bankName: dbModel.bankName || null,
    accountNumber: dbModel.accountNumber || null,
    type: dbModel.type || null,
    currency: dbModel.currency || null,
    chartAccountId: isPopulated ? String((chartAccount as Record<string, unknown>)._id) : dbModel.chartAccountId ? String(dbModel.chartAccountId) : null,
    chartAccountCode: isPopulated ? ((chartAccount as Record<string, unknown>).code as string) || null : null,
    openingBalance: dbModel.openingBalance || 0,
    currentBalance,
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IBankAccountModel[], balanceByChartAccountId: Map<string, number>): bankAccountDto[] => {
  return dbModels.map((m) => {
    const chartAccount = m.chartAccountId as unknown as Record<string, unknown> | null;
    const isPopulated = chartAccount && typeof chartAccount === "object" && "_id" in chartAccount;
    const key = isPopulated ? String((chartAccount as Record<string, unknown>)._id) : String(m.chartAccountId);
    return mapDbToDto(m, balanceByChartAccountId.get(key) || 0);
  });
};

export { mapDbToDto, mapDbListToDtoList };
