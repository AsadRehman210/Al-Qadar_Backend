import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { JournalEntryModel } from "../../model/finance/journal-entry-model";
import { LedgerLineModel } from "../../model/finance/ledger-line-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { journalEntryDto } from "../../utility/dtos/finance/journal-entry-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/journal-entry-mapper";
import { buildSearchCondition } from "../../utility/helper/list-query";

interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

interface CreateJournalEntryInput {
  tenant: TenantScope;
  createdBy: string;
  date: Date;
  memo?: string;
  lines: JournalLineInput[];
}

interface PostAutoJournalInput {
  tenant: TenantScope;
  createdBy: string;
  date: Date;
  debitAccountCode: string;
  creditAccountCode: string;
  amount: number;
  ref: string;
  source: string;
  memo?: string;
}

const generateJournalNo = async (tenant: TenantScope): Promise<string> => {
  const count = await JournalEntryModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `JRN-${String(count + 1).padStart(6, "0")}`;
};

// The one path anything in the system uses to write to Finance — validates
// the entry is balanced (this is the "hard-coded offsetting account" bug the
// frontend's own Journal Entries fake data has, avoided here for real) and
// fans the header out into individual LedgerLine rows.
const createJournalEntry = async (input: CreateJournalEntryInput) => {
  const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  if (input.lines.length < 2 || totalDebit !== totalCredit) {
    throw new Error("Journal entry is not balanced: total debit must equal total credit.");
  }

  const journalNo = await generateJournalNo(input.tenant);

  const journal = await JournalEntryModel.create({
    journalNo,
    date: input.date,
    memo: input.memo || null,
    status: "Posted",
    lines: input.lines.map((line) => ({
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
    })),
    adminId: input.tenant.adminId,
    merchantId: input.tenant.merchantId,
    createdBy: input.createdBy,
  });

  await LedgerLineModel.insertMany(
    input.lines.map((line) => ({
      date: input.date,
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      ref: journal.journalNo,
      source: input.memo || "Manual Journal Entry",
      currency: "SAR",
      journalEntryId: journal._id,
      adminId: input.tenant.adminId,
      merchantId: input.tenant.merchantId,
    }))
  );

  return journal;
};

// Convenience wrapper for the common case: one debit account, one credit
// account, looked up by code within the caller's own tenant. This is what
// Loan/Expense/Provident Fund services call — they never touch
// ChartOfAccount/JournalEntry/LedgerLine models directly.
const postAutoJournal = async (input: PostAutoJournalInput): Promise<void> => {
  const [debitAccount, creditAccount] = await Promise.all([
    ChartOfAccountModel.findOne({ adminId: input.tenant.adminId, merchantId: input.tenant.merchantId, code: input.debitAccountCode }).lean(),
    ChartOfAccountModel.findOne({ adminId: input.tenant.adminId, merchantId: input.tenant.merchantId, code: input.creditAccountCode }).lean(),
  ]);

  if (!debitAccount || !creditAccount) {
    const missingCode = !debitAccount ? input.debitAccountCode : input.creditAccountCode;
    throw new Error(`Chart of Accounts is missing code ${missingCode} for this tenant.`);
  }

  await createJournalEntry({
    tenant: input.tenant,
    createdBy: input.createdBy,
    date: input.date,
    memo: input.memo || input.source,
    lines: [
      { accountId: String(debitAccount._id), debit: input.amount, credit: 0 },
      { accountId: String(creditAccount._id), debit: 0, credit: input.amount },
    ],
  });
};

export interface JournalEntryListOptions {
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: JournalEntryListOptions = {}
): Promise<{ totalCount: number; result: journalEntryDto[] }> => {
  const startIndex = (page - 1) * limit;
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate || options.toDate) {
    if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
    if (options.toDate) dateFilter.$lte = new Date(options.toDate);
  }

  const query: Record<string, unknown> = {
    ...filter,
    ...buildSearchCondition(options.search, ["journalNo", "memo"]),
    ...(options.status ? { status: options.status } : {}),
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  const data = await JournalEntryModel.find(query)
    .populate("lines.accountId", "code name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await JournalEntryModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<journalEntryDto | null> => {
  const data = await JournalEntryModel.findOne({ _id: id, ...filter }).populate("lines.accountId", "code name").lean();
  return data ? mapDbToDto(data) : null;
};

export { createJournalEntry, postAutoJournal, getAll, get };
