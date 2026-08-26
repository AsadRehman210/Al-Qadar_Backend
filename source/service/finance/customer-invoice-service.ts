import { CustomerInvoiceModel } from "../../model/finance/customer-invoice-model";
import { VatConfigModel } from "../../model/finance/vat-config-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { customerInvoiceDto } from "../../utility/dtos/finance/customer-invoice-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/customer-invoice-mapper";
import { buildSearchCondition } from "../../utility/helper/list-query";
import { createJournalEntry } from "./journal-service";
import { ensureAccountsReceivable, ensureVatPayable } from "../../utility/helper/finance-accounts";

const LINE_POPULATE = "lines.revenueAccountId";

export interface CustomerInvoiceListOptions {
  search?: string;
  status?: string;
}

interface InvoiceLineInput {
  description: string;
  amount: number;
  revenueAccountId: string;
}

interface CreateCustomerInvoiceInput {
  customerName: string;
  customerContact?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency?: string;
  lines: InvoiceLineInput[];
}

interface CustomerInvoiceResult {
  errorCode: "success" | "not_found" | "invalid_status";
  result: customerInvoiceDto | null;
}

const create = async (
  data: CreateCustomerInvoiceInput,
  scope: TenantScope,
  createdBy: string
): Promise<CustomerInvoiceResult> => {
  const subtotal = data.lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const vatConfig = await VatConfigModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId }).lean();
  const vatRate = vatConfig?.rate || 0;
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;

  const invoice = await CustomerInvoiceModel.create({
    customerName: data.customerName,
    customerContact: data.customerContact || null,
    invoiceNumber: data.invoiceNumber,
    invoiceDate: new Date(data.invoiceDate),
    dueDate: new Date(data.dueDate),
    lines: data.lines,
    subtotal,
    vatRate,
    vatAmount,
    total: subtotal + vatAmount,
    paidToDate: 0,
    currency: data.currency || "SAR",
    status: "Draft",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await invoice.populate(LINE_POPULATE, "code name");
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: CustomerInvoiceListOptions = {}
): Promise<{ totalCount: number; result: customerInvoiceDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["customerName", "invoiceNumber"]),
    ...(options.status ? { status: options.status } : {}),
  };

  const data = await CustomerInvoiceModel.find(query)
    .populate(LINE_POPULATE, "code name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await CustomerInvoiceModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<customerInvoiceDto | null> => {
  const data = await CustomerInvoiceModel.findOne({ _id: id, ...filter }).populate(LINE_POPULATE, "code name").lean();
  return data ? mapDbToDto(data) : null;
};

// Only a Draft invoice can still be edited freely — once sent it has already
// posted real ledger lines, so its lines/total are permanently fixed (same
// immutability rule Vendor Bills and Journal Entries follow).
const update = async (
  id: string,
  data: Partial<CreateCustomerInvoiceInput>,
  filter: Record<string, unknown>
): Promise<CustomerInvoiceResult> => {
  const invoice = await CustomerInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  if (invoice.status !== "Draft") {
    return { errorCode: "invalid_status", result: null };
  }

  if (data.customerName) invoice.customerName = data.customerName;
  if (data.customerContact !== undefined) invoice.customerContact = data.customerContact;
  if (data.invoiceNumber) invoice.invoiceNumber = data.invoiceNumber;
  if (data.invoiceDate) invoice.invoiceDate = new Date(data.invoiceDate);
  if (data.dueDate) invoice.dueDate = new Date(data.dueDate);
  if (data.lines) {
    invoice.lines = data.lines as any;
    const subtotal = data.lines.reduce((sum, line) => sum + (line.amount || 0), 0);
    const vatConfig = await VatConfigModel.findOne(filter).lean();
    const vatRate = vatConfig?.rate || 0;
    const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
    invoice.subtotal = subtotal;
    invoice.vatRate = vatRate;
    invoice.vatAmount = vatAmount;
    invoice.total = subtotal + vatAmount;
  }
  await invoice.save();
  await invoice.populate(LINE_POPULATE, "code name");

  return { errorCode: "success", result: mapDbToDto(invoice) };
};

// Sending a Draft invoice is the single moment it hits the ledger — one
// multi-line journal entry: Accounts Receivable is debited for the full
// total including VAT, each invoice line credits its own revenue account,
// and output VAT (if any) credits VAT Payable (owed to the government).
const send = async (
  id: string,
  filter: Record<string, unknown>,
  scope: TenantScope,
  createdBy: string
): Promise<CustomerInvoiceResult> => {
  const invoice = await CustomerInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  if (invoice.status !== "Draft") {
    return { errorCode: "invalid_status", result: null };
  }

  const accountsReceivable = await ensureAccountsReceivable(scope, createdBy);

  const vatLines = [];
  if (invoice.vatAmount) {
    const vatPayable = await ensureVatPayable(scope, createdBy);
    vatLines.push({ accountId: String(vatPayable._id), debit: 0, credit: invoice.vatAmount });
  }

  await createJournalEntry({
    tenant: scope,
    createdBy,
    date: new Date(),
    memo: `Invoice ${invoice.invoiceNumber} — ${invoice.customerName}`,
    lines: [
      { accountId: String(accountsReceivable._id), debit: invoice.total || 0, credit: 0 },
      ...(invoice.lines || []).map((line) => ({ accountId: String(line.revenueAccountId), debit: 0, credit: line.amount })),
      ...vatLines,
    ],
  });

  invoice.status = "Sent";
  await invoice.save();
  await invoice.populate(LINE_POPULATE, "code name");

  return { errorCode: "success", result: mapDbToDto(invoice) };
};

const cancel = async (id: string, filter: Record<string, unknown>): Promise<CustomerInvoiceResult> => {
  const invoice = await CustomerInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  if (invoice.status !== "Draft") {
    return { errorCode: "invalid_status", result: null };
  }
  invoice.status = "Cancelled";
  await invoice.save();
  await invoice.populate(LINE_POPULATE, "code name");
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

export { create, getAll, get, update, send, cancel };
