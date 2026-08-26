import { VendorBillModel } from "../../model/finance/vendor-bill-model";
import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { VatConfigModel } from "../../model/finance/vat-config-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { vendorBillDto } from "../../utility/dtos/finance/vendor-bill-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/finance/vendor-bill-mapper";
import { buildSearchCondition } from "../../utility/helper/list-query";
import { createJournalEntry } from "./journal-service";
import { ensureVatReceivable } from "../../utility/helper/finance-accounts";

const LINE_POPULATE = "lines.expenseAccountId";

export interface VendorBillListOptions {
  search?: string;
  status?: string;
}

interface BillLineInput {
  description: string;
  amount: number;
  expenseAccountId: string;
}

interface CreateVendorBillInput {
  vendorName: string;
  vendorContact?: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  currency?: string;
  lines: BillLineInput[];
}

interface VendorBillResult {
  errorCode: "success" | "not_found" | "invalid_status";
  result: vendorBillDto | null;
}

const create = async (
  data: CreateVendorBillInput,
  scope: TenantScope,
  createdBy: string
): Promise<VendorBillResult> => {
  const subtotal = data.lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const vatConfig = await VatConfigModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId }).lean();
  const vatRate = vatConfig?.rate || 0;
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;

  const bill = await VendorBillModel.create({
    vendorName: data.vendorName,
    vendorContact: data.vendorContact || null,
    billNumber: data.billNumber,
    billDate: new Date(data.billDate),
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
  await bill.populate(LINE_POPULATE, "code name");
  return { errorCode: "success", result: mapDbToDto(bill) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: VendorBillListOptions = {}
): Promise<{ totalCount: number; result: vendorBillDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["vendorName", "billNumber"]),
    ...(options.status ? { status: options.status } : {}),
  };

  const data = await VendorBillModel.find(query)
    .populate(LINE_POPULATE, "code name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await VendorBillModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<vendorBillDto | null> => {
  const data = await VendorBillModel.findOne({ _id: id, ...filter }).populate(LINE_POPULATE, "code name").lean();
  return data ? mapDbToDto(data) : null;
};

// Only a Draft bill can still be edited freely — once approved it has
// already posted real ledger lines, so its lines/total are permanently fixed
// (same immutability rule journal entries follow).
const update = async (
  id: string,
  data: Partial<CreateVendorBillInput>,
  filter: Record<string, unknown>
): Promise<VendorBillResult> => {
  const bill = await VendorBillModel.findOne({ _id: id, ...filter });
  if (!bill) {
    return { errorCode: "not_found", result: null };
  }
  if (bill.status !== "Draft") {
    return { errorCode: "invalid_status", result: null };
  }

  if (data.vendorName) bill.vendorName = data.vendorName;
  if (data.vendorContact !== undefined) bill.vendorContact = data.vendorContact;
  if (data.billNumber) bill.billNumber = data.billNumber;
  if (data.billDate) bill.billDate = new Date(data.billDate);
  if (data.dueDate) bill.dueDate = new Date(data.dueDate);
  if (data.lines) {
    bill.lines = data.lines as any;
    const subtotal = data.lines.reduce((sum, line) => sum + (line.amount || 0), 0);
    const vatConfig = await VatConfigModel.findOne(filter).lean();
    const vatRate = vatConfig?.rate || 0;
    const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
    bill.subtotal = subtotal;
    bill.vatRate = vatRate;
    bill.vatAmount = vatAmount;
    bill.total = subtotal + vatAmount;
  }
  await bill.save();
  await bill.populate(LINE_POPULATE, "code name");

  return { errorCode: "success", result: mapDbToDto(bill) };
};

// Approving a Draft bill is the single moment it hits the ledger — one
// multi-line journal entry: each bill line debits its own expense account,
// input VAT (if any) debits VAT Receivable (reclaimable from the
// government), and Accounts Payable (seed code "2000") is credited for the
// full total including VAT.
const approve = async (
  id: string,
  filter: Record<string, unknown>,
  scope: TenantScope,
  createdBy: string
): Promise<VendorBillResult> => {
  const bill = await VendorBillModel.findOne({ _id: id, ...filter });
  if (!bill) {
    return { errorCode: "not_found", result: null };
  }
  if (bill.status !== "Draft") {
    return { errorCode: "invalid_status", result: null };
  }

  const accountsPayable = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: "2000",
  }).lean();
  if (!accountsPayable) {
    throw new Error("Chart of Accounts is missing code 2000 (Accounts Payable) for this tenant.");
  }

  const vatLines = [];
  if (bill.vatAmount) {
    const vatReceivable = await ensureVatReceivable(scope, createdBy);
    vatLines.push({ accountId: String(vatReceivable._id), debit: bill.vatAmount, credit: 0 });
  }

  await createJournalEntry({
    tenant: scope,
    createdBy,
    date: new Date(),
    memo: `Vendor Bill ${bill.billNumber} — ${bill.vendorName}`,
    lines: [
      ...(bill.lines || []).map((line) => ({ accountId: String(line.expenseAccountId), debit: line.amount, credit: 0 })),
      ...vatLines,
      { accountId: String(accountsPayable._id), debit: 0, credit: bill.total || 0 },
    ],
  });

  bill.status = "Approved";
  await bill.save();
  await bill.populate(LINE_POPULATE, "code name");

  return { errorCode: "success", result: mapDbToDto(bill) };
};

const cancel = async (id: string, filter: Record<string, unknown>): Promise<VendorBillResult> => {
  const bill = await VendorBillModel.findOne({ _id: id, ...filter });
  if (!bill) {
    return { errorCode: "not_found", result: null };
  }
  if (bill.status !== "Draft") {
    return { errorCode: "invalid_status", result: null };
  }
  bill.status = "Cancelled";
  await bill.save();
  await bill.populate(LINE_POPULATE, "code name");
  return { errorCode: "success", result: mapDbToDto(bill) };
};

export { create, getAll, get, update, approve, cancel };
