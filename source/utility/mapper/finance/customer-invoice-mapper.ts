import { customerInvoiceDto, customerInvoiceLineDto } from "../../dtos/finance/customer-invoice-dto";
import { ICustomerInvoiceModel } from "../../../model/finance/customer-invoice-model";

const mapLine = (line: unknown): customerInvoiceLineDto => {
  const raw = line as Record<string, unknown>;
  const account = raw.revenueAccountId as Record<string, unknown> | string | null;
  const isPopulated = account && typeof account === "object";
  return {
    description: (raw.description as string) || "",
    amount: (raw.amount as number) || 0,
    revenueAccountId: isPopulated ? String((account as Record<string, unknown>)._id) : String(account || ""),
    revenueAccountCode: isPopulated ? ((account as Record<string, unknown>).code as string) || null : null,
    revenueAccountName: isPopulated ? ((account as Record<string, unknown>).name as string) || null : null,
  };
};

const mapDbToDto = (dbModel: ICustomerInvoiceModel): customerInvoiceDto => {
  const total = dbModel.total || 0;
  const paidToDate = dbModel.paidToDate || 0;
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    customerName: dbModel.customerName || null,
    customerContact: dbModel.customerContact || null,
    invoiceNumber: dbModel.invoiceNumber || null,
    invoiceDate: dbModel.invoiceDate || null,
    dueDate: dbModel.dueDate || null,
    lines: (dbModel.lines || []).map(mapLine),
    subtotal: dbModel.subtotal || 0,
    vatRate: dbModel.vatRate || 0,
    vatAmount: dbModel.vatAmount || 0,
    total,
    paidToDate,
    balanceDue: total - paidToDate,
    currency: dbModel.currency || null,
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ICustomerInvoiceModel[]): customerInvoiceDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
