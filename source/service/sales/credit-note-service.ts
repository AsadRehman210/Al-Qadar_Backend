import { CreditNoteModel } from "../../model/sales/credit-note-model";
import { SaleInvoiceModel } from "../../model/sales/sale-invoice-model";
import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { creditNoteDto } from "../../utility/dtos/sales/credit-note-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/sales/credit-note-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { adjustStock } from "../warehouse/stock-level-service";
import { releaseBatch } from "../inventory/stock-batch-service";
import { createJournalEntry } from "../finance/journal-service";
import { ensureAccountsReceivable, ensureVatPayable } from "../../utility/helper/finance-accounts";
import { toDateOnly, formatDateOnly } from "../../utility/helper/date-only";

const POPULATE: [string, string][] = [
  ["customerId", "name"],
  ["warehouseId", "name"],
  ["originalInvoiceId", "invoiceNumber"],
  ["products.variantId", "variantName sku"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) await doc.populate(field, select);
  return doc;
};

const getRevenueAccount = async (scope: TenantScope) => {
  const account = await ChartOfAccountModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    code: "4000",
  }).lean();
  if (!account) {
    throw new Error("Chart of Accounts is missing code 4000 (Operating Revenue) for this tenant.");
  }
  return account;
};

export interface CreditNoteListOptions {
  search?: string;
  customerId?: string;
  status?: string;
}

interface CreditNoteLineInput {
  variantId: string;
  productName?: string;
  qty: number;
  price: number;
  costPrice?: number;
  unit?: string;
  batchId?: string | null;
  expiryDate?: string | Date | null;
  taxPercent?: number | null;
}

interface ReturnableLine {
  variantId: string;
  productName: string | null;
  price: number;
  costPrice: number;
  unit: string;
  batchId: string | null;
  expiryDate: string | null;
  taxPercent: number | null;
  soldQty: number;
  alreadyCreditedQty: number;
  maxReturnableQty: number;
}

interface CreateCreditNoteInput {
  customerId: string;
  date: string;
  originalInvoiceId: string;
  warehouseId: string;
  reason?: string;
  returnType?: string;
  products: CreditNoteLineInput[];
  discount?: number;
  taxPercent?: number;
  notes?: string;
  currency?: string;
}

interface CreditNoteResult {
  errorCode:
    | "success"
    | "not_found"
    | "invalid_status"
    | "invoice_not_found"
    | "customer_mismatch"
    | "exceeds_line_qty";
  result: creditNoteDto | null;
  overReturns?: { variantId: string; requestedQty: number; maxReturnableQty: number }[];
}

// Reasons where the returned goods are actually fit to go back on the shelf.
// "Overcharge" never restocks (no physical item moves — it's a pure billing
// adjustment); Damaged/Quality issue/Expired/Other never restock either
// (the item is back in the warehouse's possession but not resalable).
const RESTOCK_REASONS = new Set(["Customer return", "Wrong item delivered"]);

// Shared by create()'s validation and getReturnableLines() so both always
// agree on exactly how much of a given invoice line is still creditable —
// keyed by variantId+batchId since the same variant can appear on more than
// one line at different batches/costs.
const lineKey = (variantId: unknown, batchId: unknown) => `${String(variantId)}|${batchId ? String(batchId) : ""}`;

const getAlreadyCreditedMap = async (originalInvoiceId: string): Promise<Map<string, number>> => {
  const existingCreditNotes = await CreditNoteModel.find({
    originalInvoiceId,
    status: { $ne: "Voided" },
  }).lean();
  const map = new Map<string, number>();
  for (const note of existingCreditNotes) {
    for (const line of note.products || []) {
      const key = lineKey(line.variantId, line.batchId);
      map.set(key, (map.get(key) || 0) + (line.qty || 0));
    }
  }
  return map;
};

const generateCnNo = async (tenant: TenantScope): Promise<string> => {
  const count = await CreditNoteModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `CN-${String(count + 1).padStart(6, "0")}`;
};

// A line's own tax rate if it's carrying an override, otherwise the shared
// credit note-level rate — same "same for all"/"different per product"
// convention as Sale Invoice's own effectiveLineTaxPercent.
const effectiveLineTaxPercent = (line: { taxPercent?: number | null }, cnTaxPercent: number) =>
  line.taxPercent !== undefined && line.taxPercent !== null ? Number(line.taxPercent) || 0 : Number(cnTaxPercent) || 0;

const buildLines = (products: CreditNoteLineInput[], cnTaxPercent: number) =>
  products.map((line) => {
    const lineSubtotal = line.qty * line.price;
    const rate = effectiveLineTaxPercent(line, cnTaxPercent);
    const taxAmount = Math.round(lineSubtotal * (rate / 100) * 100) / 100;
    return {
      variantId: line.variantId,
      productName: line.productName || null,
      qty: line.qty,
      price: line.price,
      costPrice: line.costPrice ?? 0,
      unit: line.unit || "pcs",
      batchId: line.batchId || null,
      expiryDate: line.expiryDate ? toDateOnly(line.expiryDate) : null,
      taxPercent: line.taxPercent ?? null,
      taxAmount,
    };
  });

// Discount is a flat deduction off the gross line total, applied only at the
// credit note level (Sale Invoice itself carries no discount field, so there
// is no existing per-line convention to mirror here) — it does not get
// allocated back across each line's own tax computation.
const computeTotals = (lines: { qty: number; price: number; taxAmount?: number | null }[], discount = 0) => {
  const gross = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const subtotal = gross - discount;
  const taxAmount = Math.round(lines.reduce((sum, l) => sum + (l.taxAmount || 0), 0) * 100) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

const create = async (
  data: CreateCreditNoteInput,
  scope: TenantScope,
  createdBy: string
): Promise<CreditNoteResult> => {
  const originalInvoice = await SaleInvoiceModel.findOne({
    _id: data.originalInvoiceId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  }).lean();
  if (!originalInvoice) {
    return { errorCode: "invoice_not_found", result: null };
  }
  if (String(originalInvoice.customerId) !== String(data.customerId)) {
    return { errorCode: "customer_mismatch", result: null };
  }

  // A return can never credit more of a line than was actually sold on it,
  // net of whatever's already been credited by other (non-Voided) credit
  // notes against the same invoice line (matched by variant + batch).
  const soldByKey = new Map<string, number>();
  for (const line of originalInvoice.products || []) {
    soldByKey.set(lineKey(line.variantId, line.batchId), (soldByKey.get(lineKey(line.variantId, line.batchId)) || 0) + (line.qty || 0));
  }
  const creditedByKey = await getAlreadyCreditedMap(data.originalInvoiceId);
  const overReturns: { variantId: string; requestedQty: number; maxReturnableQty: number }[] = [];
  for (const line of data.products) {
    const key = lineKey(line.variantId, line.batchId);
    const remaining = (soldByKey.get(key) || 0) - (creditedByKey.get(key) || 0);
    if (line.qty > remaining) {
      overReturns.push({ variantId: line.variantId, requestedQty: line.qty, maxReturnableQty: Math.max(0, remaining) });
    }
  }
  if (overReturns.length) {
    return { errorCode: "exceeds_line_qty", result: null, overReturns };
  }

  const lines = buildLines(data.products, data.taxPercent || 0);
  const { subtotal, taxAmount, total } = computeTotals(lines, data.discount || 0);

  const cnNumber = await generateCnNo(scope);

  const cn = await CreditNoteModel.create({
    cnNumber,
    customerId: data.customerId,
    date: toDateOnly(data.date),
    originalInvoiceId: data.originalInvoiceId,
    warehouseId: data.warehouseId,
    reason: data.reason || null,
    returnType: data.returnType || "Full return",
    products: lines,
    discount: data.discount || 0,
    subtotal,
    taxPercent: data.taxPercent || 0,
    taxAmount,
    total,
    currency: data.currency || "SAR",
    status: "Draft",
    notes: data.notes || null,
    stockApplied: false,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await populateAll(cn);
  return { errorCode: "success", result: mapDbToDto(cn) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: CreditNoteListOptions = {}
): Promise<{ totalCount: number; result: creditNoteDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["cnNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { customerId: "customerId", status: "status" }),
  };

  let cursor = CreditNoteModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await CreditNoteModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<creditNoteDto | null> => {
  let cursor = CreditNoteModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  return data ? mapDbToDto(data) : null;
};

// What the Add Credit Note form actually renders: the original invoice's
// own sold lines, each annotated with how much of it is still creditable.
// A credit note's line items are never a free product pick — they can only
// ever be "some or all of what this invoice actually sold", so the frontend
// builds its line list from this instead of a generic catalog search.
const getReturnableLines = async (
  invoiceId: string,
  filter: Record<string, unknown>
): Promise<{
  errorCode: "success" | "not_found";
  invoice: { id: string; invoiceNumber: string | null; customerId: string | null; customerName: string | null; warehouseId: string | null; warehouseName: string | null; currency: string; taxPercent: number } | null;
  lines: ReturnableLine[];
}> => {
  const invoice = await SaleInvoiceModel.findOne({ _id: invoiceId, ...filter })
    .populate("customerId", "name")
    .populate("warehouseId", "name")
    .lean();
  if (!invoice) {
    return { errorCode: "not_found", invoice: null, lines: [] };
  }

  const creditedByKey = await getAlreadyCreditedMap(invoiceId);
  const lines: ReturnableLine[] = (invoice.products || []).map((line: any) => {
    const key = lineKey(line.variantId, line.batchId);
    const soldQty = line.qty || 0;
    const alreadyCreditedQty = creditedByKey.get(key) || 0;
    return {
      variantId: String(line.variantId),
      productName: line.productName || null,
      price: line.price,
      costPrice: line.costPrice ?? 0,
      unit: line.unit || "pcs",
      batchId: line.batchId ? String(line.batchId) : null,
      expiryDate: formatDateOnly(line.expiryDate),
      taxPercent: line.taxPercent ?? null,
      soldQty,
      alreadyCreditedQty,
      maxReturnableQty: Math.max(0, soldQty - alreadyCreditedQty),
    };
  });

  const customer = invoice.customerId as any;
  const warehouse = invoice.warehouseId as any;
  return {
    errorCode: "success",
    invoice: {
      id: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber || null,
      customerId: customer?._id ? String(customer._id) : customer ? String(customer) : null,
      customerName: customer?.name || null,
      warehouseId: warehouse?._id ? String(warehouse._id) : warehouse ? String(warehouse) : null,
      warehouseName: warehouse?.name || null,
      currency: invoice.currency || "SAR",
      // The invoice's own flat rate — used to default the credit note's own
      // taxPercent instead of a hardcoded guess, since a return's tax should
      // match what was actually charged on the original sale.
      taxPercent: invoice.taxPercent ?? 0,
    },
    lines,
  };
};

// Draft -> Approved -> Applied, with Voided reachable from Draft/Approved
// (mirrors Sale Invoice's deliveryStatus lock: once a terminal state with
// real financial/stock effects is reached, it can't be moved away from).
// Applied is the single moment stock is restocked and the original invoice's
// balance is credited — guarded by stockApplied so it can only ever fire once.
const VALID_NEXT_STATUS: Record<string, string[]> = {
  Draft: ["Draft", "Approved", "Voided"],
  Approved: ["Approved", "Applied", "Voided"],
  Applied: ["Applied"],
  Voided: ["Voided"],
};

const updateStatus = async (
  id: string,
  status: string,
  filter: Record<string, unknown>,
  actor: string
): Promise<CreditNoteResult> => {
  const cn = await CreditNoteModel.findOne({ _id: id, ...filter });
  if (!cn) {
    return { errorCode: "not_found", result: null };
  }

  const allowed = VALID_NEXT_STATUS[cn.status || "Draft"] || [];
  if (!allowed.includes(status)) {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: cn.adminId ? String(cn.adminId) : null,
    merchantId: cn.merchantId ? String(cn.merchantId) : null,
  };

  if (status === "Applied" && !cn.stockApplied) {
    // Only a return in resalable condition actually goes back on the shelf.
    // Damaged/expired/quality-issue returns are physically received but
    // written off, and an Overcharge credit note never had a physical item
    // move in the first place — either way, stock is left untouched while
    // the financial reversal below still applies unconditionally.
    if (RESTOCK_REASONS.has(cn.reason || "")) {
      for (const line of cn.products || []) {
        await adjustStock(
          scope,
          String(line.variantId),
          String(cn.warehouseId),
          "add",
          line.qty,
          `Credit Note ${cn.cnNumber} — return received`,
          actor
        );
        // Keeps the specific batch's own remainingQty in sync with the
        // aggregate StockLevel total — without this, Stock Detail's batch
        // history keeps showing the pre-return quantity even though the
        // warehouse total already went up.
        if (line.batchId) {
          await releaseBatch(String(line.batchId), line.qty);
        }
      }
    }

    const accountsReceivable = await ensureAccountsReceivable(scope, actor);
    const revenueAccount = await getRevenueAccount(scope);
    const vatLines = [];
    if (cn.taxAmount) {
      const vatPayable = await ensureVatPayable(scope, actor);
      vatLines.push({ accountId: String(vatPayable._id), debit: cn.taxAmount, credit: 0 });
    }
    await createJournalEntry({
      tenant: scope,
      createdBy: actor,
      date: toDateOnly(new Date()),
      memo: `Credit Note ${cn.cnNumber} — ${cn.reason || "return"}`,
      lines: [
        { accountId: String(revenueAccount._id), debit: cn.subtotal || 0, credit: 0 },
        ...vatLines,
        { accountId: String(accountsReceivable._id), debit: 0, credit: cn.total || 0 },
      ],
    });

    // The original invoice's own paymentHistory is never touched here — a
    // return is not a cash payment, and treating it as one used to hide the
    // real distinction between "balance reduced" and "cash actually owed
    // back". Sale Invoice now derives creditedAmount/refundDue straight from
    // this collection (see getCreditedAmounts in sale-invoice-service.ts),
    // and any real cash refund is its own separate act (addRefund).

    cn.stockApplied = true;
    cn.approvedBy = actor as any;
  }

  cn.status = status as any;
  await cn.save();
  await populateAll(cn);
  return { errorCode: "success", result: mapDbToDto(cn) };
};

export { create, getAll, get, getReturnableLines, updateStatus };
