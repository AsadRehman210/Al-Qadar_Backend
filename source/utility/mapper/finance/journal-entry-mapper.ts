import { journalEntryDto, journalLineDto } from "../../dtos/finance/journal-entry-dto";
import { IJournalEntryModel } from "../../../model/finance/journal-entry-model";

// Lines are populated via "lines.accountId" — each line's accountId comes
// back as either a populated ChartOfAccount doc or a raw ObjectId depending
// on whether the caller populated it.
const mapLine = (line: unknown): journalLineDto => {
  const raw = line as Record<string, unknown>;
  const account = raw.accountId as Record<string, unknown> | string | null;
  const isPopulated = account && typeof account === "object";
  return {
    accountId: isPopulated ? String((account as Record<string, unknown>)._id) : String(account || ""),
    accountCode: isPopulated ? ((account as Record<string, unknown>).code as string) || null : null,
    accountName: isPopulated ? ((account as Record<string, unknown>).name as string) || null : null,
    debit: (raw.debit as number) || 0,
    credit: (raw.credit as number) || 0,
  };
};

const mapDbToDto = (dbModel: IJournalEntryModel): journalEntryDto => {
  const lines = (dbModel.lines || []).map(mapLine);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    journalNo: dbModel.journalNo || null,
    date: dbModel.date || null,
    memo: dbModel.memo || null,
    status: dbModel.status || null,
    lines,
    totalDebit: lines.reduce((sum, line) => sum + (line.debit || 0), 0),
    totalCredit: lines.reduce((sum, line) => sum + (line.credit || 0), 0),
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IJournalEntryModel[]): journalEntryDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
