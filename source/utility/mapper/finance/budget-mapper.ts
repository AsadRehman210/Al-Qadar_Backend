import { budgetDto } from "../../dtos/finance/budget-dto";
import { IBudgetModel } from "../../../model/finance/budget-model";

const populatedField = <T extends Record<string, unknown>>(value: unknown): T | null => {
  return value && typeof value === "object" && "_id" in (value as Record<string, unknown>) ? (value as T) : null;
};

const mapDbToDto = (dbModel: IBudgetModel): budgetDto => {
  const account = populatedField<{ _id: unknown; code?: string; name?: string; type?: string }>(dbModel.accountId);

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    accountId: account ? String(account._id) : dbModel.accountId ? String(dbModel.accountId) : null,
    accountCode: account?.code || null,
    accountName: account?.name || null,
    accountType: account?.type || null,
    period: dbModel.period || null,
    budgetAmount: dbModel.budgetAmount || 0,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IBudgetModel[]): budgetDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
