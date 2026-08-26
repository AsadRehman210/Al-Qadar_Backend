import { ledgerLineDto } from "../../dtos/finance/ledger-line-dto";
import { ILedgerLineModel } from "../../../model/finance/ledger-line-model";

const mapDbToDto = (dbModel: ILedgerLineModel, balance?: number): ledgerLineDto => {
  const account = dbModel.accountId as unknown as Record<string, unknown> | null;
  const isPopulated = account && typeof account === "object" && "code" in account;
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    date: dbModel.date || null,
    accountId: isPopulated ? String((account as Record<string, unknown>)._id) : dbModel.accountId ? String(dbModel.accountId) : null,
    accountCode: isPopulated ? ((account as Record<string, unknown>).code as string) || null : null,
    accountName: isPopulated ? ((account as Record<string, unknown>).name as string) || null : null,
    debit: dbModel.debit || 0,
    credit: dbModel.credit || 0,
    balance,
    ref: dbModel.ref || null,
    source: dbModel.source || null,
    currency: dbModel.currency || null,
    journalEntryId: dbModel.journalEntryId ? String(dbModel.journalEntryId) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdAt: dbModel.createdAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ILedgerLineModel[]): ledgerLineDto[] => {
  return dbModels.map((model) => mapDbToDto(model));
};

export { mapDbToDto, mapDbListToDtoList };
