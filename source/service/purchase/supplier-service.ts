import { SupplierModel } from "../../model/purchase/supplier-model";
import { PurchaseInvoiceModel } from "../../model/purchase/purchase-invoice-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { supplierDto } from "../../utility/dtos/purchase/supplier-dto";
import { mapDbToDto } from "../../utility/mapper/purchase/supplier-mapper";
import { mapDbListToDtoList as mapInvoiceList } from "../../utility/mapper/purchase/purchase-invoice-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { toDateOnly, formatDateOnly } from "../../utility/helper/date-only";

export interface SupplierListOptions {
  search?: string;
  supplierType?: string;
  status?: string;
}

interface CreateSupplierInput {
  name: string;
  email?: string;
  phone: string;
  emergencyPhone?: string;
  address?: string;
  country?: string;
  city?: string;
  supplierType?: string;
  taxNumber?: string;
  registrationNumber?: string;
  licenseNumber?: string;
  licenseExpiryDate?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  contactPersonDesignation?: string;
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
  branchCode?: string;
  swift?: string;
  openingBalance?: number;
  status?: string;
}

interface SupplierResult {
  errorCode: "success" | "not_found" | "duplicate_phone";
  result: supplierDto | null;
}

// Phone is the supplier's real identity now (supplierCode is gone) — unique
// per tenant, checked on both create and update (excluding self on update).
// Mirrors Customer's findDuplicatePhone exactly.
const findDuplicatePhone = async (phone: string, scope: TenantScope, excludeId?: string) => {
  return SupplierModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    phone,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
};

const create = async (
  data: CreateSupplierInput,
  scope: TenantScope,
  createdBy: string
): Promise<SupplierResult> => {
  const existing = await findDuplicatePhone(data.phone, scope);
  if (existing) {
    return { errorCode: "duplicate_phone", result: null };
  }

  const supplier = await SupplierModel.create({
    ...data,
    licenseExpiryDate: data.licenseExpiryDate ? toDateOnly(data.licenseExpiryDate) : null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  return { errorCode: "success", result: mapDbToDto(supplier, supplier.openingBalance || 0) };
};

// openingBalance + Σ(invoice.total) − Σ(payments across those invoices) —
// always computed, never stored. Mirrors Customer's computeBalance exactly.
const computeBalance = (openingBalance: number, invoices: { total?: number | null; paymentHistory?: { amount?: number | null }[] }[]) => {
  return invoices.reduce((bal, inv) => {
    const paid = (inv.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    return bal + (inv.total || 0) - paid;
  }, openingBalance);
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: SupplierListOptions = {}
): Promise<{ totalCount: number; result: supplierDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["name", "email", "phone"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      supplierType: "supplierType",
      status: "status",
    }),
  };

  // Newest first — matches Sale/Purchase Invoice's own list ordering, so a
  // just-added supplier shows up on page 1 immediately instead of wherever
  // its name happens to fall alphabetically.
  const data = await SupplierModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 }).lean();
  const count = await SupplierModel.countDocuments(query);

  const supplierIds = data.map((s) => s._id);
  const invoices = await PurchaseInvoiceModel.find({ supplierId: { $in: supplierIds } })
    .select("supplierId total paymentHistory")
    .lean();
  const invoicesBySupplier = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const key = String(inv.supplierId);
    if (!invoicesBySupplier.has(key)) invoicesBySupplier.set(key, []);
    invoicesBySupplier.get(key)!.push(inv);
  }

  const result = data.map((s) =>
    mapDbToDto(s, computeBalance(s.openingBalance || 0, invoicesBySupplier.get(String(s._id)) || []))
  );

  return { totalCount: count, result };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<supplierDto | null> => {
  const data = await SupplierModel.findOne({ _id: id, ...filter }).lean();
  if (!data) return null;
  const invoices = await PurchaseInvoiceModel.find({ supplierId: id }).select("total paymentHistory").lean();
  return mapDbToDto(data, computeBalance(data.openingBalance || 0, invoices));
};

export interface InvoiceListOptions {
  fromDate?: string;
  toDate?: string;
  amount?: number;
  invoiceNumber?: string;
}

const buildInvoiceDateFilter = (options: InvoiceListOptions) => {
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);
  return Object.keys(dateFilter).length ? { date: dateFilter } : {};
};

// GET /:id/invoices — paginated, with the same date/amount/invoice-number
// filters (applied server-side) Customer's own invoice list uses.
const getInvoices = async (
  supplierId: string,
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: InvoiceListOptions = {}
): Promise<{ totalCount: number; result: ReturnType<typeof mapInvoiceList> }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    supplierId,
    ...filter,
    ...buildInvoiceDateFilter(options),
    ...(options.invoiceNumber ? buildSearchCondition(options.invoiceNumber, ["invoiceNumber"]) : {}),
    ...(options.amount !== undefined && !Number.isNaN(options.amount) ? { total: options.amount } : {}),
  };
  const data = await PurchaseInvoiceModel.find(query)
    .populate("supplierId", "name")
    .populate("warehouseId", "name")
    .skip(startIndex)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();
  const count = await PurchaseInvoiceModel.countDocuments(query);
  return { totalCount: count, result: mapInvoiceList(data) };
};

export interface PaymentListOptions extends InvoiceListOptions {}

// GET /:id/payments — flattened paymentHistory across this supplier's
// invoices, filtered (date/amount/invoice number) and paginated in-memory
// since these are embedded sub-documents, not their own collection.
const getPayments = async (
  supplierId: string,
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: PaymentListOptions = {}
) => {
  const invoiceQuery: Record<string, unknown> = {
    supplierId,
    ...filter,
    ...(options.invoiceNumber ? buildSearchCondition(options.invoiceNumber, ["invoiceNumber"]) : {}),
  };
  const invoices = await PurchaseInvoiceModel.find(invoiceQuery).select("invoiceNumber paymentHistory").lean();
  const fromDate = options.fromDate ? new Date(options.fromDate) : null;
  const toDate = options.toDate ? new Date(options.toDate) : null;

  let allPayments = invoices.flatMap((inv) =>
    (inv.paymentHistory || []).map((p) => ({
      invoiceId: String(inv._id),
      invoiceNumber: inv.invoiceNumber,
      date: p.date,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
    }))
  );

  if (fromDate) allPayments = allPayments.filter((p) => p.date && new Date(p.date) >= fromDate);
  if (toDate) allPayments = allPayments.filter((p) => p.date && new Date(p.date) <= toDate);
  if (options.amount !== undefined && !Number.isNaN(options.amount)) {
    allPayments = allPayments.filter((p) => Number(p.amount) === options.amount);
  }

  allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const startIndex = (page - 1) * limit;
  return {
    totalCount: allPayments.length,
    result: allPayments.slice(startIndex, startIndex + limit).map((p) => ({ ...p, date: formatDateOnly(p.date) })),
  };
};

export interface LedgerEntry {
  id: string;
  date: string | null;
  type: "Invoice" | "Payment";
  reference: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

// GET /:id/ledger — dedicated, paginated statement of every debit (purchase
// invoice) and credit (payment) for this supplier, oldest first, with a
// running balance computed once server-side off the full history — mirrors
// Customer's getLedger exactly.
const getLedger = async (
  supplierId: string,
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; openingBalance: number; result: LedgerEntry[] }> => {
  const supplier = await SupplierModel.findOne({ _id: supplierId, ...filter }).lean();
  if (!supplier) {
    return { totalCount: 0, openingBalance: 0, result: [] };
  }

  const invoices = await PurchaseInvoiceModel.find({ supplierId }).select("invoiceNumber date total paymentHistory").lean();

  const invoiceEntries = invoices.map((inv) => ({
    id: `inv-${inv._id}`,
    date: inv.date || null,
    type: "Invoice" as const,
    reference: inv.invoiceNumber || null,
    debit: Number(inv.total) || 0,
    credit: 0,
  }));

  const paymentEntries = invoices.flatMap((inv) =>
    (inv.paymentHistory || []).map((pay, idx) => ({
      id: `pay-${inv._id}-${idx}`,
      date: pay.date || null,
      type: "Payment" as const,
      reference: pay.reference || inv.invoiceNumber || null,
      debit: 0,
      credit: Number(pay.amount) || 0,
    }))
  );

  const openingBalance = Number(supplier.openingBalance) || 0;
  let runningBalance = openingBalance;
  const entries: LedgerEntry[] = [...invoiceEntries, ...paymentEntries]
    .sort((a, b) => {
      const at = a.date ? new Date(a.date).getTime() : 0;
      const bt = b.date ? new Date(b.date).getTime() : 0;
      return at - bt;
    })
    .map((e) => {
      runningBalance += e.debit - e.credit;
      return { ...e, date: formatDateOnly(e.date), runningBalance };
    });

  const startIndex = (page - 1) * limit;
  return {
    totalCount: entries.length,
    openingBalance,
    result: entries.slice(startIndex, startIndex + limit),
  };
};

// GET /:id/balance
const getBalance = async (supplierId: string, filter: Record<string, unknown>): Promise<number | null> => {
  const supplier = await SupplierModel.findOne({ _id: supplierId, ...filter }).lean();
  if (!supplier) return null;
  const invoices = await PurchaseInvoiceModel.find({ supplierId }).select("total paymentHistory").lean();
  return computeBalance(supplier.openingBalance || 0, invoices);
};

export interface DebitCreditSummary {
  openingBalance: number;
  totalPaid: number;
  balanceDue: number;
}

// GET /:id/debit-credit-balance — the Debit/Credit Balance tab's only real
// data need (opening balance, total paid, balance due), computed here in
// one pass over just `total`/`paymentHistory` instead of the tab pulling
// every full invoice through the invoices list endpoint just to sum three
// numbers client-side. Mirrors Customer's getDebitCreditSummary exactly.
const getDebitCreditSummary = async (
  supplierId: string,
  filter: Record<string, unknown>
): Promise<DebitCreditSummary | null> => {
  const supplier = await SupplierModel.findOne({ _id: supplierId, ...filter }).lean();
  if (!supplier) return null;
  const invoices = await PurchaseInvoiceModel.find({ supplierId }).select("total paymentHistory").lean();
  const openingBalance = supplier.openingBalance || 0;
  const totalPaid = invoices.reduce(
    (sum, inv) => sum + (inv.paymentHistory || []).reduce((s, p) => s + (p.amount || 0), 0),
    0
  );
  return { openingBalance, totalPaid, balanceDue: computeBalance(openingBalance, invoices) };
};

const getRaw = async (id: string, filter: Record<string, unknown>) => {
  return SupplierModel.findOne({ _id: id, ...filter });
};

const update = async (
  id: string,
  data: Partial<CreateSupplierInput>,
  filter: Record<string, unknown>
): Promise<SupplierResult> => {
  const supplier = await SupplierModel.findOne({ _id: id, ...filter }).lean();
  if (!supplier) {
    return { errorCode: "not_found", result: null };
  }
  if (data.phone !== undefined && data.phone !== supplier.phone) {
    const scope: TenantScope = {
      adminId: supplier.adminId ? String(supplier.adminId) : null,
      merchantId: supplier.merchantId ? String(supplier.merchantId) : null,
    };
    const existing = await findDuplicatePhone(data.phone, scope, id);
    if (existing) {
      return { errorCode: "duplicate_phone", result: null };
    }
  }

  const updateData = {
    ...data,
    ...(data.licenseExpiryDate !== undefined
      ? { licenseExpiryDate: data.licenseExpiryDate ? toDateOnly(data.licenseExpiryDate) : null }
      : {}),
    updatedAt: new Date(),
  };
  const updated = await SupplierModel.findOneAndUpdate({ _id: id, ...filter }, { $set: updateData }, { new: true }).lean();
  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<SupplierResult> => {
  const deleted = await SupplierModel.findOne({ _id: id, ...filter }).lean();
  if (!deleted) {
    return { errorCode: "not_found", result: null };
  }
  await SupplierModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(deleted) };
};

export { create, getAll, get, getRaw, getInvoices, getPayments, getLedger, getBalance, getDebitCreditSummary, update, deleteByID };
