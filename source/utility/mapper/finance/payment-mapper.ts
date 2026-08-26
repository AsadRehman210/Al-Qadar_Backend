import { paymentDto } from "../../dtos/finance/payment-dto";
import { IPaymentModel } from "../../../model/finance/payment-model";

const populatedField = <T extends Record<string, unknown>>(value: unknown): T | null => {
  return value && typeof value === "object" && "_id" in (value as Record<string, unknown>) ? (value as T) : null;
};

const mapDbToDto = (dbModel: IPaymentModel): paymentDto => {
  const bankAccount = populatedField<{ _id: unknown; name?: string }>(dbModel.bankAccountId);
  const invoice = populatedField<{ _id: unknown; invoiceNumber?: string }>(dbModel.invoiceId);
  const bill = populatedField<{ _id: unknown; billNumber?: string }>(dbModel.billId);
  const contraAccount = populatedField<{ _id: unknown; code?: string; name?: string }>(dbModel.contraAccountId);

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    date: dbModel.date || null,
    direction: dbModel.direction || null,
    amount: dbModel.amount || 0,
    method: dbModel.method || null,
    reference: dbModel.reference || null,
    party: dbModel.party || null,
    bankAccountId: bankAccount ? String(bankAccount._id) : dbModel.bankAccountId ? String(dbModel.bankAccountId) : null,
    bankAccountName: bankAccount?.name || null,
    invoiceId: invoice ? String(invoice._id) : dbModel.invoiceId ? String(dbModel.invoiceId) : null,
    invoiceNumber: invoice?.invoiceNumber || null,
    billId: bill ? String(bill._id) : dbModel.billId ? String(dbModel.billId) : null,
    billNumber: bill?.billNumber || null,
    contraAccountId: contraAccount ? String(contraAccount._id) : dbModel.contraAccountId ? String(dbModel.contraAccountId) : null,
    contraAccountCode: contraAccount?.code || null,
    contraAccountName: contraAccount?.name || null,
    journalEntryId: dbModel.journalEntryId ? String(dbModel.journalEntryId) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IPaymentModel[]): paymentDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
