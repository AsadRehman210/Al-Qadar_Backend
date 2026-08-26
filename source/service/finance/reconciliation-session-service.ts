import { ReconciliationSessionModel } from "../../model/finance/reconciliation-session-model";
import { BankAccountModel } from "../../model/finance/bank-account-model";
import * as ledgerService from "./ledger-service";

export interface reconciliationSessionDto {
  id: string;
  bankAccountId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  statementEndingBalance: number;
  bookBalance: number;
  difference: number;
  status: string | null;
}

interface CreateSessionInput {
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  statementEndingBalance: number;
}

interface SessionResult {
  errorCode: "success" | "not_found" | "invalid_status";
  result: reconciliationSessionDto | null;
}

// The book side of the comparison is never stored — it's always the real
// ledger's closing balance for that account as of periodEnd (see
// ledger-service.getByAccount), so a session can never drift from what the
// ledger actually says happened.
const withBookBalance = async (
  session: { _id: unknown; bankAccountId?: unknown; periodStart?: Date | null; periodEnd?: Date | null; statementEndingBalance?: number | null; status?: string | null },
  filter: Record<string, unknown>
): Promise<reconciliationSessionDto> => {
  const bankAccount = await BankAccountModel.findById(session.bankAccountId).lean();
  let bookBalance = 0;
  if (bankAccount) {
    const ledgerResult = await ledgerService.getByAccount(String(bankAccount.chartAccountId), filter, {
      toDate: session.periodEnd ? session.periodEnd.toISOString().slice(0, 10) : undefined,
    });
    bookBalance = ledgerResult.closingBalance;
  }
  const statementEndingBalance = session.statementEndingBalance || 0;
  return {
    id: String(session._id),
    bankAccountId: session.bankAccountId ? String(session.bankAccountId) : null,
    periodStart: session.periodStart || null,
    periodEnd: session.periodEnd || null,
    statementEndingBalance,
    bookBalance,
    difference: statementEndingBalance - bookBalance,
    status: session.status || null,
  };
};

const create = async (
  data: CreateSessionInput,
  scope: { adminId: string | null; merchantId: string | null },
  createdBy: string
): Promise<SessionResult> => {
  const bankAccount = await BankAccountModel.findOne({
    _id: data.bankAccountId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  }).lean();
  if (!bankAccount) {
    return { errorCode: "not_found", result: null };
  }

  const session = await ReconciliationSessionModel.create({
    bankAccountId: bankAccount._id,
    periodStart: new Date(data.periodStart),
    periodEnd: new Date(data.periodEnd),
    statementEndingBalance: data.statementEndingBalance,
    status: "Open",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  const result = await withBookBalance(session, { adminId: scope.adminId, merchantId: scope.merchantId });
  return { errorCode: "success", result };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { bankAccountId?: string } = {}
): Promise<{ totalCount: number; result: reconciliationSessionDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    ...filter,
    ...(options.bankAccountId ? { bankAccountId: options.bankAccountId } : {}),
  };

  const data = await ReconciliationSessionModel.find(query).skip(startIndex).limit(limit).sort({ _id: -1 }).lean();
  const count = await ReconciliationSessionModel.countDocuments(query);

  const result = await Promise.all(data.map((session) => withBookBalance(session, filter)));
  return { totalCount: count, result };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<reconciliationSessionDto | null> => {
  const session = await ReconciliationSessionModel.findOne({ _id: id, ...filter }).lean();
  if (!session) return null;
  return withBookBalance(session, filter);
};

const close = async (id: string, filter: Record<string, unknown>): Promise<SessionResult> => {
  const session = await ReconciliationSessionModel.findOne({ _id: id, ...filter });
  if (!session) {
    return { errorCode: "not_found", result: null };
  }
  if (session.status !== "Open") {
    return { errorCode: "invalid_status", result: null };
  }
  session.status = "Reconciled";
  await session.save();
  const result = await withBookBalance(session, filter);
  return { errorCode: "success", result };
};

export { create, getAll, get, close };
