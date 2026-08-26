import { incomeEntryDto } from "../../dtos/finance/income-entry-dto";
import { IIncomeEntryModel } from "../../../model/finance/income-entry-model";

const populatedField = <T extends Record<string, unknown>>(value: unknown): T | null => {
  return value && typeof value === "object" && "_id" in (value as Record<string, unknown>) ? (value as T) : null;
};

const mapDbToDto = (dbModel: IIncomeEntryModel): incomeEntryDto => {
  const bankAccount = populatedField<{ _id: unknown; name?: string }>(dbModel.bankAccountId);
  const revenueAccount = populatedField<{ _id: unknown; code?: string; name?: string }>(dbModel.revenueAccountId);

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    date: dbModel.date || null,
    source: dbModel.source || null,
    description: dbModel.description || null,
    amount: dbModel.amount || 0,
    currency: dbModel.currency || null,
    bankAccountId: bankAccount ? String(bankAccount._id) : dbModel.bankAccountId ? String(dbModel.bankAccountId) : null,
    bankAccountName: bankAccount?.name || null,
    revenueAccountId: revenueAccount ? String(revenueAccount._id) : dbModel.revenueAccountId ? String(dbModel.revenueAccountId) : null,
    revenueAccountCode: revenueAccount?.code || null,
    revenueAccountName: revenueAccount?.name || null,
    journalEntryId: dbModel.journalEntryId ? String(dbModel.journalEntryId) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IIncomeEntryModel[]): incomeEntryDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
