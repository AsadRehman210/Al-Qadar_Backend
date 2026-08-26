import { businessExpenseDto } from "../../dtos/finance/business-expense-dto";
import { IBusinessExpenseModel } from "../../../model/finance/business-expense-model";

const populatedField = <T extends Record<string, unknown>>(value: unknown): T | null => {
  return value && typeof value === "object" && "_id" in (value as Record<string, unknown>) ? (value as T) : null;
};

const mapDbToDto = (dbModel: IBusinessExpenseModel): businessExpenseDto => {
  const bankAccount = populatedField<{ _id: unknown; name?: string }>(dbModel.bankAccountId);
  const expenseAccount = populatedField<{ _id: unknown; code?: string; name?: string }>(dbModel.expenseAccountId);

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    date: dbModel.date || null,
    category: dbModel.category || null,
    description: dbModel.description || null,
    amount: dbModel.amount || 0,
    currency: dbModel.currency || null,
    bankAccountId: bankAccount ? String(bankAccount._id) : dbModel.bankAccountId ? String(dbModel.bankAccountId) : null,
    bankAccountName: bankAccount?.name || null,
    expenseAccountId: expenseAccount ? String(expenseAccount._id) : dbModel.expenseAccountId ? String(dbModel.expenseAccountId) : null,
    expenseAccountCode: expenseAccount?.code || null,
    expenseAccountName: expenseAccount?.name || null,
    journalEntryId: dbModel.journalEntryId ? String(dbModel.journalEntryId) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IBusinessExpenseModel[]): businessExpenseDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
