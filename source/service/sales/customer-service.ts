import { CustomerModel } from "../../model/sales/customer-model";
import { SaleInvoiceModel } from "../../model/sales/sale-invoice-model";
import { CreditNoteModel } from "../../model/sales/credit-note-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { customerDto } from "../../utility/dtos/sales/customer-dto";
import { mapDbToDto } from "../../utility/mapper/sales/customer-mapper";
import { mapDbListToDtoList as mapInvoiceList } from "../../utility/mapper/sales/sale-invoice-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { formatDateOnly } from "../../utility/helper/date-only";
import { getCreditedAmounts, applyReturnFigures } from "./sale-invoice-service";

export interface CustomerListOptions {
  search?: string;
  customerType?: string;
  status?: string;
}

interface CreateCustomerInput {
  name: string;
  email?: string;
  phone: string;
  emergencyPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  customerType?: string;
  companyName?: string;
  customerSegment?: string;
  taxNumber?: string;
  registrationNumber?: string;
  openingBalance?: number;
  creditLimit?: number;
  creditDays?: number;
  status?: string;
}

interface CustomerResult {
  errorCode: "success" | "not_found" | "duplicate_phone" | "opening_balance_locked";
  result: customerDto | null;
}

// Phone is the customer's real identity now (customerCode is gone) — unique
// per tenant, checked on both create and update (excluding self on update).
const findDuplicatePhone = async (phone: string, scope: TenantScope, excludeId?: string) => {
  return CustomerModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    phone,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
};

const money = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1000) / 1000;
};

const create = async (
  data: CreateCustomerInput,
  scope: TenantScope,
  createdBy: string
): Promise<CustomerResult> => {
  const existing = await findDuplicatePhone(data.phone, scope);
  if (existing) {
    return { errorCode: "duplicate_phone", result: null };
  }

  const customer = await CustomerModel.create({
    ...data,
    openingBalance: money(data.openingBalance),
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  return { errorCode: "success", result: mapDbToDto(customer, customer.openingBalance || 0, false) };
};

// Cancelled invoices are reversed on the ledger — they never happened
// financially, so they must not lock opening balance or appear in derived
// balances. Lock is per this customer only, never tenant-wide.
const notCancelled = { deliveryStatus: { $ne: "Cancelled" } };

const hasNonCancelledSaleInvoice = async (customerId: string): Promise<boolean> => {
  const found = await SaleInvoiceModel.exists({ customerId, ...notCancelled });
  return Boolean(found);
};

interface BalanceInvoice {
  _id?: unknown;
  total?: number | null;
  paymentHistory?: { amount?: number | null }[];
  refundHistory?: { amount?: number | null }[];
}

// openingBalance + Σ(invoice.total) − Σ(payments) − Σ(applied credit notes)
// + Σ(refunds paid back to the customer). Always computed, never stored.
// Applied credit notes reduce what the customer owes; a cash refund after
// an overpayment brings the running position back toward zero.
const computeBalance = (
  openingBalance: number,
  invoices: BalanceInvoice[],
  creditedByInvoice: Map<string, number>
) => {
  return invoices.reduce((bal, inv) => {
    const paid = (inv.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const refunded = (inv.refundHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const credited = inv._id ? creditedByInvoice.get(String(inv._id)) || 0 : 0;
    return bal + (inv.total || 0) - paid - credited + refunded;
  }, openingBalance);
};

const loadAppliedCredits = async (invoices: BalanceInvoice[]) =>
  getCreditedAmounts(invoices.map((inv) => String(inv._id)).filter((id) => id && id !== "undefined"));

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: CustomerListOptions = {}
): Promise<{ totalCount: number; result: customerDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["name", "email", "phone"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      customerType: "customerType",
      status: "status",
    }),
  };

  // Newest first — matches Sale/Purchase Invoice's own list ordering, so a
  // just-added customer shows up on page 1 immediately instead of wherever
  // its name happens to fall alphabetically.
  const data = await CustomerModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 }).lean();
  const count = await CustomerModel.countDocuments(query);

  const customerIds = data.map((c) => c._id);
  const invoices = await SaleInvoiceModel.find({ customerId: { $in: customerIds }, ...notCancelled })
    .select("customerId total paymentHistory refundHistory")
    .lean();
  const invoicesByCustomer = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const key = String(inv.customerId);
    if (!invoicesByCustomer.has(key)) invoicesByCustomer.set(key, []);
    invoicesByCustomer.get(key)!.push(inv);
  }
  const creditedByInvoice = await loadAppliedCredits(invoices);

  const result = data.map((c) =>
    mapDbToDto(
      c,
      computeBalance(c.openingBalance || 0, invoicesByCustomer.get(String(c._id)) || [], creditedByInvoice),
      (invoicesByCustomer.get(String(c._id)) || []).length > 0
    )
  );

  return { totalCount: count, result };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<customerDto | null> => {
  const data = await CustomerModel.findOne({ _id: id, ...filter }).lean();
  if (!data) return null;
  const invoices = await SaleInvoiceModel.find({ customerId: id, ...notCancelled }).select("total paymentHistory refundHistory").lean();
  const creditedByInvoice = await loadAppliedCredits(invoices);
  return mapDbToDto(
    data,
    computeBalance(data.openingBalance || 0, invoices, creditedByInvoice),
    invoices.length > 0
  );
};

export interface InvoiceListOptions {
  fromDate?: string;
  toDate?: string;
  amount?: number;
  invoiceNumber?: string;
  deliveryStatus?: string;
  paymentStatus?: string;
}

const buildInvoiceDateFilter = (options: InvoiceListOptions) => {
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);
  return Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
};

// GET /:id/invoices — every Sale Invoice for this customer (including
// Cancelled — history stays visible), paginated, with date/amount/
// invoice-number/delivery/payment filters applied server-side.
const getInvoices = async (
  customerId: string,
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: InvoiceListOptions = {}
): Promise<{ totalCount: number; result: ReturnType<typeof mapInvoiceList> }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    customerId,
    ...filter,
    ...buildInvoiceDateFilter(options),
    ...buildExactFilters(options as Record<string, unknown>, {
      deliveryStatus: "deliveryStatus",
      paymentStatus: "paymentStatus",
    }),
    ...(options.invoiceNumber ? buildSearchCondition(options.invoiceNumber, ["invoiceNumber"]) : {}),
    ...(options.amount !== undefined && !Number.isNaN(options.amount) ? { total: options.amount } : {}),
  };
  const data = await SaleInvoiceModel.find(query)
    .populate("customerId", "name")
    .populate("warehouseId", "name")
    .skip(startIndex)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();
  const count = await SaleInvoiceModel.countDocuments(query);
  const mapped = mapInvoiceList(data);
  const creditedByInvoice = await getCreditedAmounts(mapped.map((d) => d.id));
  return {
    totalCount: count,
    result: mapped.map((dto) => applyReturnFigures(dto, creditedByInvoice.get(dto.id) || 0)),
  };
};

export interface PaymentListOptions extends InvoiceListOptions {}

// GET /:id/payments — every payment entry across this customer's invoices,
// flattened, filtered (date/amount/invoice number) and sorted newest-first.
// Paginated in-memory since these are embedded sub-documents, not their own
// collection — the filters are applied before pagination so the page counts
// stay correct.
const getPayments = async (
  customerId: string,
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: PaymentListOptions = {}
) => {
  const invoiceQuery: Record<string, unknown> = {
    customerId,
    ...filter,
    ...notCancelled,
    ...(options.invoiceNumber ? buildSearchCondition(options.invoiceNumber, ["invoiceNumber"]) : {}),
  };
  const invoices = await SaleInvoiceModel.find(invoiceQuery).select("invoiceNumber paymentHistory").lean();
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
  type: "Invoice" | "Payment" | "CreditNote" | "Refund";
  reference: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

const LEDGER_TYPE_ORDER: Record<LedgerEntry["type"], number> = {
  Invoice: 0,
  Payment: 1,
  CreditNote: 2,
  Refund: 3,
};

// Invoice rows use createdAt (a real timestamp). Payments / credit notes /
// refunds use a date-only field stored at midnight UTC. Comparing those
// raw instants puts a same-day payment or CN *before* the invoice, which
// breaks the statement. Sort by calendar day first, then type so the
// running balance always goes Invoice → Payment → CreditNote → Refund.
const ledgerCalendarKey = (value: Date | string | null | undefined): string =>
  formatDateOnly(value) || "";

const compareLedgerEntries = (
  a: { date: Date | string | null; type: LedgerEntry["type"] },
  b: { date: Date | string | null; type: LedgerEntry["type"] }
): number => {
  const day = ledgerCalendarKey(a.date).localeCompare(ledgerCalendarKey(b.date));
  if (day !== 0) return day;
  const type = LEDGER_TYPE_ORDER[a.type] - LEDGER_TYPE_ORDER[b.type];
  if (type !== 0) return type;
  const at = a.date ? new Date(a.date).getTime() : 0;
  const bt = b.date ? new Date(b.date).getTime() : 0;
  return at - bt;
};

// GET /:id/ledger — a single, dedicated, paginated statement of every debit
// (invoice) and credit (payment) for this customer, oldest first, with a
// running balance — its own endpoint rather than the frontend re-deriving
// this off the Invoices tab's own API response, so the running balance is
// always computed once, server-side, off the complete history (pagination
// only slices the already-fully-computed, already-ordered result).
const getLedger = async (
  customerId: string,
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; openingBalance: number; result: LedgerEntry[] }> => {
  const customer = await CustomerModel.findOne({ _id: customerId, ...filter }).lean();
  if (!customer) {
    return { totalCount: 0, openingBalance: 0, result: [] };
  }

  const invoices = await SaleInvoiceModel.find({ customerId, ...notCancelled }).select("invoiceNumber createdAt total paymentHistory refundHistory").lean();
  const creditNotes = await CreditNoteModel.find({
    customerId,
    status: "Applied",
  }).select("cnNumber date total originalInvoiceId").lean();

  const invoiceEntries = invoices.map((inv) => ({
    id: `inv-${inv._id}`,
    date: inv.createdAt || null,
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

  const creditNoteEntries = creditNotes.map((cn) => ({
    id: `cn-${cn._id}`,
    date: cn.date || null,
    type: "CreditNote" as const,
    reference: cn.cnNumber || null,
    debit: 0,
    credit: Number(cn.total) || 0,
  }));

  const refundEntries = invoices.flatMap((inv) =>
    (inv.refundHistory || []).map((ref, idx) => ({
      id: `ref-${inv._id}-${idx}`,
      date: ref.date || null,
      type: "Refund" as const,
      reference: ref.reference || inv.invoiceNumber || null,
      debit: Number(ref.amount) || 0,
      credit: 0,
    }))
  );

  const openingBalance = Number(customer.openingBalance) || 0;
  let runningBalance = openingBalance;
  const entries: LedgerEntry[] = [...invoiceEntries, ...paymentEntries, ...creditNoteEntries, ...refundEntries]
    .sort(compareLedgerEntries)
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
const getBalance = async (customerId: string, filter: Record<string, unknown>): Promise<number | null> => {
  const customer = await CustomerModel.findOne({ _id: customerId, ...filter }).lean();
  if (!customer) return null;
  const invoices = await SaleInvoiceModel.find({ customerId, ...notCancelled }).select("total paymentHistory refundHistory").lean();
  const creditedByInvoice = await loadAppliedCredits(invoices);
  return computeBalance(customer.openingBalance || 0, invoices, creditedByInvoice);
};

export interface DebitCreditSummary {
  openingBalance: number;
  totalPaid: number;
  totalCredited: number;
  balanceDue: number;
}

// GET /:id/debit-credit-balance — the Debit/Credit Balance tab's only real
// data need (opening balance, total paid, balance due), computed here in
// one pass over just `total`/`paymentHistory` instead of the tab pulling
// every full invoice (lines, dates, statuses, ...) through the invoices
// list endpoint just to sum three numbers client-side.
const getDebitCreditSummary = async (
  customerId: string,
  filter: Record<string, unknown>
): Promise<DebitCreditSummary | null> => {
  const customer = await CustomerModel.findOne({ _id: customerId, ...filter }).lean();
  if (!customer) return null;
  const invoices = await SaleInvoiceModel.find({ customerId, ...notCancelled }).select("total paymentHistory refundHistory").lean();
  const openingBalance = customer.openingBalance || 0;
  const totalPaid = invoices.reduce(
    (sum, inv) => sum + (inv.paymentHistory || []).reduce((s, p) => s + (p.amount || 0), 0),
    0
  );
  const creditedByInvoice = await loadAppliedCredits(invoices);
  const totalCredited = [...creditedByInvoice.values()].reduce((sum, n) => sum + n, 0);
  return {
    openingBalance,
    totalPaid,
    totalCredited,
    balanceDue: computeBalance(openingBalance, invoices, creditedByInvoice),
  };
};

const getRaw = async (id: string, filter: Record<string, unknown>) => {
  return CustomerModel.findOne({ _id: id, ...filter });
};

const update = async (
  id: string,
  data: Partial<CreateCustomerInput>,
  filter: Record<string, unknown>
): Promise<CustomerResult> => {
  const customer = await CustomerModel.findOne({ _id: id, ...filter }).lean();
  if (!customer) {
    return { errorCode: "not_found", result: null };
  }
  if (data.phone !== undefined && data.phone !== customer.phone) {
    const scope: TenantScope = {
      adminId: customer.adminId ? String(customer.adminId) : null,
      merchantId: customer.merchantId ? String(customer.merchantId) : null,
    };
    const existing = await findDuplicatePhone(data.phone, scope, id);
    if (existing) {
      return { errorCode: "duplicate_phone", result: null };
    }
  }

  if (data.openingBalance !== undefined) {
    const next = money(data.openingBalance);
    const current = money(customer.openingBalance);
    if (next !== current) {
      const locked = await hasNonCancelledSaleInvoice(id);
      if (locked) {
        return { errorCode: "opening_balance_locked", result: null };
      }
    }
    data = { ...data, openingBalance: next };
  }

  const updated = await CustomerModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: { ...data, updatedAt: new Date() } },
    { new: true }
  ).lean();
  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  const locked = await hasNonCancelledSaleInvoice(id);
  return { errorCode: "success", result: mapDbToDto(updated, null, locked) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<CustomerResult> => {
  const deleted = await CustomerModel.findOne({ _id: id, ...filter }).lean();
  if (!deleted) {
    return { errorCode: "not_found", result: null };
  }
  await CustomerModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(deleted) };
};

export { create, getAll, get, getRaw, getInvoices, getPayments, getLedger, getBalance, getDebitCreditSummary, update, deleteByID };
