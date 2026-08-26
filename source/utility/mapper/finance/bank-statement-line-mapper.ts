import { bankStatementLineDto } from "../../dtos/finance/bank-statement-line-dto";
import { IBankStatementLineModel } from "../../../model/finance/bank-statement-line-model";

const mapDbToDto = (dbModel: IBankStatementLineModel): bankStatementLineDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    bankAccountId: dbModel.bankAccountId ? String(dbModel.bankAccountId) : null,
    date: dbModel.date || null,
    description: dbModel.description || null,
    amount: dbModel.amount || 0,
    reference: dbModel.reference || null,
    matched: Boolean(dbModel.matched),
    matchedLedgerLineId: dbModel.matchedLedgerLineId ? String(dbModel.matchedLedgerLineId) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IBankStatementLineModel[]): bankStatementLineDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
