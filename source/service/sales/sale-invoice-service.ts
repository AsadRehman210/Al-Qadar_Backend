import { SaleInvoiceModel } from "../../model/sales/sale-invoice-model";
import { CreditNoteModel } from "../../model/sales/credit-note-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { saleInvoiceDto } from "../../utility/dtos/sales/sale-invoice-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/sales/sale-invoice-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { adjustStock, getStockMapForWarehouse } from "../warehouse/stock-level-service";
import { consumeBatch, releaseBatch } from "../inventory/stock-batch-service";
import { createJournalEntry } from "../finance/journal-service";
import { ensureAccountsReceivable, ensureVatPayable, ensureInventory, ensureCostOfGoodsSold } from "../../utility/helper/finance-accounts";
import { toDateOnly, formatDateOnly } from "../../utility/helper/date-only";

const POPULATE: [string, string][] = [
  ["customerId", "name"],
  ["warehouseId", "name"],
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

const getCashOrBankAccount = async (scope: TenantScope, method: string | undefined) => {
  const code = method === "Cash" ? "1000" : "1010";
  const account = await ChartOfAccountModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, code }).lean();
  if (!account) {
    throw new Error(`Chart of Accounts is missing code ${code} for this tenant.`);
  }
  return account;
};

// Only an Applied credit note is a real, financially-recognized credit —
// Draft/Approved haven't posted their journal entry yet, and Voided never
// will. Bulk version powers getAll (one query for a whole page); the single-
// invoice callers below just read the one entry back out of the same map.
const getCreditedAmounts = async (invoiceIds: string[]): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  if (!invoiceIds.length) return map;
  const notes = await CreditNoteModel.find({ originalInvoiceId: { $in: invoiceIds }, status: "Applied" }).lean();
  for (const note of notes) {
    const key = String(note.originalInvoiceId);
    map.set(key, (map.get(key) || 0) + (note.total || 0));
  }
  return map;
};

// Attaches creditedAmount/refundDue/refundedAmount onto an already-mapped
// dto — paymentHistory only ever holds real cash now (see credit-note-
// service.ts's updateStatus), so paidAmount here is pure cash received.
// Floating-point subtraction across several payment/credit amounts can land
// a hair off zero (e.g. 0.049999999999998934) — rounded to cents so a fully
// settled invoice never shows a phantom balance/refund due to binary
// float imprecision.
const round2 = (n: number): number => Math.round(n * 100) / 100;

const applyReturnFigures = (dto: saleInvoiceDto, creditedAmount: number): saleInvoiceDto => {
  const paidAmount = (dto.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const refundedAmount = (dto.refundHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const netTotal = (dto.total || 0) - creditedAmount;
  dto.creditedAmount = round2(creditedAmount);
  dto.balanceDue = round2(Math.max(0, netTotal - paidAmount));
  dto.refundDue = round2(Math.max(0, paidAmount - netTotal - refundedAmount));
  dto.refundedAmount = round2(refundedAmount);
  dto.paidAmount = round2(paidAmount);
  // paymentStatus is recomputed here rather than trusted from the stored
  // field — the stored value only ever updates inside addPayment, so it goes
  // stale the moment a credit note changes what's actually owed. "Paid" is
  // reserved for genuinely settled (nothing owed either direction); an
  // invoice sitting on an unpaid refund is still "Partial", never "Paid" —
  // showing Paid there would read as "nothing left to resolve" when the
  // business still owes the customer money back.
  if (paidAmount === 0) dto.paymentStatus = "Pending";
  else if (dto.balanceDue > 0 || dto.refundDue > 0) dto.paymentStatus = "Partial";
  else dto.paymentStatus = "Paid";
  return dto;
};

export interface SaleInvoiceListOptions {
  search?: string;
  customerId?: string;
  deliveryStatus?: string;
  paymentStatus?: string;
  fromDate?: string;
  toDate?: string;
}

interface SaleLineInput {
  variantId: string;
  productName?: string;
  qty: number;
  price: number;
  unit?: string;
  // Which specific batch this line sells from — optional, see the model's
  // ISaleLine comment for the same note.
  batchId?: string;
  // undefined/null = use the invoice's own taxPercent; set = this line's
  // own override. Same "same for all" vs "different per product" flow as
  // Purchase Invoice.
  taxPercent?: number | null;
}

// Every line's own effective rate — its own override if set, otherwise the
// invoice-level rate. Mirrors Purchase Invoice's identical helper exactly.
const effectiveLineTaxPercent = (line: { taxPercent?: number | null }, invoiceTaxPercent: number): number =>
  line.taxPercent !== undefined && line.taxPercent !== null ? line.taxPercent : invoiceTaxPercent;

interface CreateSaleInvoiceInput {
  customerId: string;
  warehouseId: string;
  receiverName?: string;
  products: SaleLineInput[];
  taxPercent?: number;
  shippingAddress?: string;
  deliveryDate: string;
  notes?: string;
  currency?: string;
  // Set only when this invoice was created via Quotation's manual "Continue
  // to Sale Invoice" flow — a structured back-link so the Sale Detail UI can
  // show "From Quotation QUO-000123" instead of relying on it being buried
  // in notes.
  convertedFromQuotationId?: string;
  convertedFromQuoteNumber?: string;
}

export interface StockShortage {
  variantId: string;
  variantName: string | null;
  sku: string | null;
  available: number;
  requested: number;
  // Present only for a batch-level shortage (a line's chosen batch doesn't
  // have enough remainingQty) — absent for the aggregate warehouse-level check.
  batchId?: string;
}

interface SaleInvoiceResult {
  errorCode: "success" | "not_found" | "invalid_status" | "exceeds_balance" | "exceeds_refund" | "insufficient_stock";
  result: saleInvoiceDto | null;
  shortages?: StockShortage[];
}

const generateInvoiceNo = async (tenant: TenantScope): Promise<string> => {
  const count = await SaleInvoiceModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `INV-${String(count + 1).padStart(6, "0")}`;
};

interface StockLineRef {
  variantId: unknown;
  qty: number;
  batchId?: unknown;
}

const resolveRefId = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
};

const toStockLines = (products: unknown[]): StockLineRef[] =>
  (products || []).map((raw) => {
    const line = raw as StockLineRef;
    return {
      variantId: resolveRefId(line.variantId),
      qty: Number(line.qty) || 0,
      batchId: line.batchId ? resolveRefId(line.batchId) : undefined,
    };
  });

// The one place that moves physical stock for a sale — Delivered subtracts,
// Cancel/delete (when stockApplied) adds back. Batch remainingQty and the
// warehouse StockLevel total always move together, using the batch's own
// variant/warehouse when a line is pinned to one.
const applyStockForProducts = async (
  scope: TenantScope,
  warehouseId: string,
  products: StockLineRef[],
  direction: "subtract" | "add",
  reason: string,
  actor: string
): Promise<void> => {
  for (const line of toStockLines(products)) {
    const qty = Number(line.qty) || 0;
    let variantId = String(line.variantId || "");
    let targetWarehouseId = warehouseId;
    const batchId = line.batchId ? String(line.batchId) : "";

    if (batchId) {
      const batch = await StockBatchModel.findById(batchId).lean();
      if (batch) {
        variantId = String(batch.variantId);
        targetWarehouseId = String(batch.warehouseId);
      }
    }

    await adjustStock(scope, variantId, targetWarehouseId, direction, qty, reason, actor);
    if (batchId) {
      if (direction === "subtract") await consumeBatch(batchId, qty);
      else await releaseBatch(batchId, qty);
    }
  }
};

// Snapshots each line's current Variant cost/sale price at creation time
// (never re-reads it later) so an invoice's own numbers never drift if the
// catalog price changes afterwards. When a line pins a specific batch, its
// exact unitCost/expiryDate are snapshotted instead of the variant's blended
// weighted-average cost — two lines of the same variant sold from different
// batches then correctly carry two different costs, same idea as Purchase's
// per-line unitCost. Also stamps each line's own computed taxAmount (its
// effective rate applied to its own subtotal) — same "same for all"/
// "different per product" flow as Purchase Invoice.
const buildProducts = async (products: SaleLineInput[], invoiceTaxPercent = 0) => {
  const variantIds = products.map((l) => l.variantId);
  const variants = await VariantModel.find({ _id: { $in: variantIds } }).lean();
  const byId = new Map(variants.map((v) => [String(v._id), v]));

  const batchIds = products.map((l) => l.batchId).filter((id): id is string => Boolean(id));
  const batches = batchIds.length ? await StockBatchModel.find({ _id: { $in: batchIds } }).lean() : [];
  const batchById = new Map(batches.map((b) => [String(b._id), b]));

  return products.map((line) => {
    const variant = byId.get(line.variantId);
    const batch = line.batchId ? batchById.get(line.batchId) : undefined;
    const lineSubtotal = line.qty * line.price;
    const rate = effectiveLineTaxPercent(line, invoiceTaxPercent);
    const taxAmount = Math.round(lineSubtotal * (rate / 100) * 100) / 100;
    return {
      variantId: line.variantId,
      productName: line.productName || null,
      qty: line.qty,
      price: line.price,
      costPrice: batch ? batch.unitCost || 0 : variant?.costPrice || 0,
      unit: line.unit || "pcs",
      batchId: line.batchId || null,
      expiryDate: batch?.expiryDate ? toDateOnly(batch.expiryDate) : null,
      taxPercent: line.taxPercent ?? null,
      taxAmount,
    };
  });
};

const computeTotals = (products: { qty: number; price: number; taxAmount?: number | null }[]) => {
  const subtotal = products.reduce((sum, l) => sum + l.qty * l.price, 0);
  const taxAmount = Math.round(products.reduce((sum, l) => sum + (l.taxAmount || 0), 0) * 100) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

// Landed cost of the goods leaving inventory — qty × the snapshotted
// per-line costPrice (batch unitCost, else variant weighted average).
const goodsCost = (products: { qty?: number | null; costPrice?: number | null }[]) =>
  Math.round(products.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.costPrice) || 0), 0) * 100) / 100;

// Stock leaves the warehouse at save time now (see create()/update()), so
// this has to catch an oversell before that write happens, not after —
// aggregating quantities per variant across all lines (the same variant can
// legitimately appear on more than one line).
const findStockShortages = async (
  scope: TenantScope,
  warehouseId: string,
  products: SaleLineInput[]
): Promise<StockShortage[]> => {
  const requestedByVariant = new Map<string, number>();
  for (const line of products) {
    const variantId = String(line.variantId);
    requestedByVariant.set(variantId, (requestedByVariant.get(variantId) || 0) + (Number(line.qty) || 0));
  }

  const availableMap = await getStockMapForWarehouse(
    { adminId: scope.adminId, merchantId: scope.merchantId },
    warehouseId
  );
  const variantIds = Array.from(requestedByVariant.keys());
  const variants = await VariantModel.find({ _id: { $in: variantIds } }).select("variantName sku").lean();
  const variantById = new Map(variants.map((v) => [String(v._id), v]));

  const shortages: StockShortage[] = [];
  for (const [variantId, requested] of requestedByVariant) {
    const available = availableMap.get(variantId) || 0;
    if (requested > available) {
      const variant = variantById.get(variantId);
      shortages.push({
        variantId,
        variantName: variant?.variantName || null,
        sku: variant?.sku || null,
        available,
        requested,
      });
    }
  }

  // Per-batch check, on top of the aggregate warehouse-level one above — a
  // line that pins a specific batch must not ask for more than that batch
  // itself has left, even if the variant's total warehouse stock is enough
  // (that total might be sitting in a different batch).
  const requestedByBatch = new Map<string, number>();
  for (const line of products) {
    if (!line.batchId) continue;
    const batchId = String(line.batchId);
    requestedByBatch.set(batchId, (requestedByBatch.get(batchId) || 0) + (Number(line.qty) || 0));
  }
  if (requestedByBatch.size) {
    const batches = await StockBatchModel.find({ _id: { $in: Array.from(requestedByBatch.keys()) } }).lean();
    const batchById = new Map(batches.map((b) => [String(b._id), b]));
    for (const [batchId, requested] of requestedByBatch) {
      const batch = batchById.get(batchId);
      // Missing / wrong-warehouse batch is the same as 0 left — otherwise a
      // stale or mistyped batchId would skip the check and oversell.
      const sameWarehouse = batch && String(batch.warehouseId) === String(warehouseId);
      const available = batch && sameWarehouse ? Number(batch.remainingQty) || 0 : 0;
      if (requested > available) {
        const variantId = batch?.variantId ? String(batch.variantId) : "";
        const variant = variantById.get(variantId);
        shortages.push({
          variantId,
          variantName: variant?.variantName || null,
          sku: variant?.sku || null,
          available,
          requested,
          batchId,
        });
      }
    }
  }

  return shortages;
};

const create = async (
  data: CreateSaleInvoiceInput,
  scope: TenantScope,
  createdBy: string
): Promise<SaleInvoiceResult> => {
  const shortages = await findStockShortages(scope, data.warehouseId, data.products);
  if (shortages.length) {
    return { errorCode: "insufficient_stock", result: null, shortages };
  }

  const invoiceNumber = await generateInvoiceNo(scope);
  const products = await buildProducts(data.products, data.taxPercent || 0);
  const { subtotal, taxAmount, total } = computeTotals(products);

  const invoice = await SaleInvoiceModel.create({
    invoiceNumber,
    customerId: data.customerId,
    warehouseId: data.warehouseId,
    receiverName: data.receiverName || null,
    products,
    subtotal,
    taxPercent: data.taxPercent || 0,
    taxAmount,
    total,
    shippingAddress: data.shippingAddress || null,
    deliveryDate: toDateOnly(data.deliveryDate),
    deliveryStatus: "Pending",
    stockApplied: false,
    paymentStatus: "Pending",
    paymentHistory: [],
    notes: data.notes || null,
    currency: data.currency || "SAR",
    convertedFromQuotationId: data.convertedFromQuotationId || null,
    convertedFromQuoteNumber: data.convertedFromQuoteNumber || null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  // Invoice create is the billing event (AR / Revenue / VAT). Stock and
  // COGS wait until Delivered — In Transit is tracking only. Cancel while
  // still Pending/InTransit reverses this journal; stock was never taken.
  const accountsReceivable = await ensureAccountsReceivable(scope, createdBy);
  const revenueAccount = await getRevenueAccount(scope);
  const vatLines = [];
  if (taxAmount) {
    const vatPayable = await ensureVatPayable(scope, createdBy);
    vatLines.push({ accountId: String(vatPayable._id), debit: 0, credit: taxAmount });
  }
  await createJournalEntry({
    tenant: scope,
    createdBy,
    date: new Date(),
    memo: `Sale Invoice ${invoiceNumber}`,
    lines: [
      { accountId: String(accountsReceivable._id), debit: total, credit: 0 },
      { accountId: String(revenueAccount._id), debit: 0, credit: subtotal },
      ...vatLines,
    ],
  });

  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: SaleInvoiceListOptions = {}
): Promise<{ totalCount: number; result: saleInvoiceDto[] }> => {
  const startIndex = (page - 1) * limit;
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);

  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["invoiceNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      customerId: "customerId",
      deliveryStatus: "deliveryStatus",
      paymentStatus: "paymentStatus",
    }),
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };

  let cursor = SaleInvoiceModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await SaleInvoiceModel.countDocuments(query);

  const result = mapDbListToDtoList(data);
  const creditedByInvoice = await getCreditedAmounts(result.map((r) => r.id));
  for (const dto of result) applyReturnFigures(dto, creditedByInvoice.get(dto.id) || 0);

  return { totalCount: count, result };
};

// The "Collected Tax" module's own view — every Sale Invoice's output VAT
// (tax is recognized at creation, not a later status — see create() above),
// with the total across every matching invoice, not just the current page.
const getCollectedTaxReport = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { search?: string; customerId?: string; fromDate?: string; toDate?: string } = {}
): Promise<{ totalCount: number; totalTaxAmount: number; result: saleInvoiceDto[] }> => {
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);

  const query = {
    ...filter,
    taxAmount: { $gt: 0 },
    // A cancelled sale never happened financially (see updateDeliveryStatus,
    // which reverses the invoice's own Revenue/AR/VAT Payable entry the
    // moment it's cancelled) — it collected no tax, so it has no business
    // showing up here.
    deliveryStatus: { $ne: "Cancelled" },
    ...buildSearchCondition(options.search, ["invoiceNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { customerId: "customerId" }),
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };

  const startIndex = (page - 1) * limit;
  let cursor = SaleInvoiceModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await SaleInvoiceModel.countDocuments(query);

  const allMatching = await SaleInvoiceModel.find(query).select("taxAmount").lean();
  const totalTaxAmount = round2(allMatching.reduce((sum, i) => sum + (i.taxAmount || 0), 0));

  return { totalCount: count, totalTaxAmount, result: mapDbListToDtoList(data) };
};

// The real Accounts Receivable view — every Sale Invoice actually still
// owed on (balanceDue > 0) or owing a refund back (refundDue > 0), computed
// fresh off the same balanceDue/refundDue this session already built for
// the Detail page and list, not a separate manually-entered "Customer
// Invoice" record type. Filtering happens after the return-figures pass
// since balanceDue/refundDue only exist once credits are factored in — not
// expressible as a single Mongo query condition.
const getReceivables = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { search?: string; customerId?: string } = {}
): Promise<{ totalCount: number; totalBalanceDue: number; totalRefundDue: number; result: saleInvoiceDto[] }> => {
  const query = {
    ...filter,
    deliveryStatus: { $ne: "Cancelled" },
    ...buildSearchCondition(options.search, ["invoiceNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { customerId: "customerId" }),
  };

  let cursor = SaleInvoiceModel.find(query).sort({ createdAt: 1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();

  const mapped = mapDbListToDtoList(data);
  const creditedByInvoice = await getCreditedAmounts(mapped.map((r) => r.id));
  for (const dto of mapped) applyReturnFigures(dto, creditedByInvoice.get(dto.id) || 0);

  const open = mapped.filter((d) => (d.balanceDue || 0) > 0 || (d.refundDue || 0) > 0);
  // Summing already-rounded per-invoice values can still drift a hair off
  // (binary float addition, same class as round2 fixes elsewhere) — rounded
  // again after the sum so the summary cards never show e.g. 3533.7000000000003.
  const totalBalanceDue = round2(open.reduce((sum, d) => sum + (d.balanceDue || 0), 0));
  const totalRefundDue = round2(open.reduce((sum, d) => sum + (d.refundDue || 0), 0));

  const startIndex = (page - 1) * limit;
  const result = open.slice(startIndex, startIndex + limit);

  return { totalCount: open.length, totalBalanceDue, totalRefundDue, result };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<saleInvoiceDto | null> => {
  let cursor = SaleInvoiceModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  if (!data) return null;

  const dto = mapDbToDto(data);
  const creditNotes = await CreditNoteModel.find({ originalInvoiceId: id, status: { $ne: "Voided" } }).populate("products.variantId", "variantName").lean();
  applyReturnFigures(dto, creditNotes.filter((cn) => cn.status === "Applied").reduce((sum, cn) => sum + (cn.total || 0), 0));
  dto.returnedItems = creditNotes.flatMap((cn) =>
    (cn.products || []).map((line: any) => {
      const qty = Number(line.qty) || 0;
      const price = Number(line.price) || 0;
      const subtotal = round2(qty * price);
      const taxPercent =
        line.taxPercent !== undefined && line.taxPercent !== null ? line.taxPercent : cn.taxPercent ?? null;
      const taxAmount =
        line.taxAmount != null ? Number(line.taxAmount) || 0 : round2(subtotal * ((Number(taxPercent) || 0) / 100));
      return {
        cnId: String(cn._id),
        cnNumber: cn.cnNumber || null,
        cnStatus: cn.status || null,
        date: formatDateOnly(cn.date),
        reason: cn.reason || null,
        variantId: String(line.variantId?._id || line.variantId),
        productName: line.productName || null,
        qty,
        price,
        unit: line.unit || null,
        costPrice: line.costPrice ?? 0,
        taxPercent,
        taxAmount,
        subtotal,
        lineTotal: round2(subtotal + taxAmount),
      };
    })
  );
  return dto;
};

// Used by Customer's derived-balance calc — every invoice for a customer,
// unpaginated, raw totals only.
const getRawByCustomer = async (customerId: string, filter: Record<string, unknown>) => {
  return SaleInvoiceModel.find({ customerId, ...filter });
};

const update = async (
  id: string,
  data: Partial<CreateSaleInvoiceInput>,
  filter: Record<string, unknown>,
  actor: string
): Promise<SaleInvoiceResult> => {
  const invoice = await SaleInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  // deliveryStatus itself is deliberately never touched here — it only ever
  // changes through updateDeliveryStatus (the dedicated PATCH). Non-stock
  // fields stay editable at any status. Products are frozen once Delivered
  // (stock/COGS already posted) or Cancelled.
  if (
    data.products !== undefined &&
    (invoice.deliveryStatus === "Delivered" || invoice.deliveryStatus === "Cancelled")
  ) {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: invoice.adminId ? String(invoice.adminId) : null,
    merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
  };

  if (data.products !== undefined) {
    const newWarehouseId = data.warehouseId !== undefined ? data.warehouseId : String(invoice.warehouseId);
    const shortages = await findStockShortages(scope, newWarehouseId, data.products);
    if (shortages.length) {
      return { errorCode: "insufficient_stock", result: null, shortages };
    }
  }

  if (data.customerId !== undefined) invoice.customerId = data.customerId as any;
  if (data.warehouseId !== undefined) invoice.warehouseId = data.warehouseId as any;
  if (data.receiverName !== undefined) invoice.receiverName = data.receiverName;
  if (data.shippingAddress !== undefined) invoice.shippingAddress = data.shippingAddress;
  if (data.deliveryDate !== undefined) invoice.deliveryDate = data.deliveryDate ? toDateOnly(data.deliveryDate) : null;
  if (data.notes !== undefined) invoice.notes = data.notes;
  if (data.products !== undefined) {
    const effectiveTaxPercent = data.taxPercent ?? invoice.taxPercent ?? 0;
    const products = await buildProducts(data.products, effectiveTaxPercent);
    const { subtotal, taxAmount, total } = computeTotals(products);
    invoice.products = products as any;
    invoice.taxPercent = effectiveTaxPercent;
    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.total = total;
  }

  await invoice.save();
  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

// Pending ↔ InTransit is tracking only. Delivered is the moment stock
// leaves and COGS/Inventory post — locked afterwards, same as Purchase
// Invoice's Received. Cancel is allowed from Pending or InTransit and
// reverses the create() AR/Revenue/VAT journal. After Delivered, returns
// go through a Credit Note.
const updateDeliveryStatus = async (
  id: string,
  status: string,
  filter: Record<string, unknown>,
  actor: string
): Promise<SaleInvoiceResult> => {
  const invoice = await SaleInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  if (invoice.deliveryStatus === "Delivered" && status !== "Delivered") {
    return { errorCode: "invalid_status", result: null };
  }
  if (invoice.deliveryStatus === "Cancelled" && status !== "Cancelled") {
    return { errorCode: "invalid_status", result: null };
  }
  if (status === "Cancelled" && invoice.deliveryStatus !== "Pending" && invoice.deliveryStatus !== "InTransit") {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: invoice.adminId ? String(invoice.adminId) : null,
    merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
  };

  if (status === "Delivered" && !invoice.stockApplied) {
    const lines = toStockLines(invoice.products || []).map((l) => ({
      variantId: String(l.variantId),
      qty: l.qty,
      price: 0,
      batchId: l.batchId ? String(l.batchId) : undefined,
    }));
    const shortages = await findStockShortages(scope, String(invoice.warehouseId), lines);
    if (shortages.length) {
      return { errorCode: "insufficient_stock", result: null, shortages };
    }
    await applyStockForProducts(
      scope,
      String(invoice.warehouseId),
      lines,
      "subtract",
      `Sale Invoice ${invoice.invoiceNumber} — delivered`,
      actor
    );
    const cogs = goodsCost((invoice.products || []) as { qty?: number | null; costPrice?: number | null }[]);
    if (cogs > 0) {
      const inventoryAccount = await ensureInventory(scope, actor);
      const cogsAccount = await ensureCostOfGoodsSold(scope, actor);
      await createJournalEntry({
        tenant: scope,
        createdBy: actor,
        date: new Date(),
        memo: `Sale Invoice ${invoice.invoiceNumber} — delivered`,
        lines: [
          { accountId: String(cogsAccount._id), debit: cogs, credit: 0 },
          { accountId: String(inventoryAccount._id), debit: 0, credit: cogs },
        ],
      });
    }
    invoice.stockApplied = true;
  }

  if (status === "Cancelled") {
    const hadStockApplied = Boolean(invoice.stockApplied);
    if (hadStockApplied) {
      await applyStockForProducts(
        scope,
        String(invoice.warehouseId),
        toStockLines(invoice.products || []),
        "add",
        `Sale Invoice ${invoice.invoiceNumber} — cancelled`,
        actor
      );
      invoice.stockApplied = false;
    }

    const accountsReceivable = await ensureAccountsReceivable(scope, actor);
    const revenueAccount = await getRevenueAccount(scope);
    const vatLines = [];
    if (invoice.taxAmount) {
      const vatPayable = await ensureVatPayable(scope, actor);
      vatLines.push({ accountId: String(vatPayable._id), debit: invoice.taxAmount, credit: 0 });
    }
    // Reverse COGS only when stock had already left (legacy invoices that
    // posted COGS at create, or any path that set stockApplied). New
    // invoices cancelled from Pending/InTransit never posted COGS.
    const cogsLines = [];
    if (hadStockApplied) {
      const cogs = goodsCost((invoice.products || []) as { qty?: number | null; costPrice?: number | null }[]);
      if (cogs > 0) {
        const inventoryAccount = await ensureInventory(scope, actor);
        const cogsAccount = await ensureCostOfGoodsSold(scope, actor);
        cogsLines.push(
          { accountId: String(inventoryAccount._id), debit: cogs, credit: 0 },
          { accountId: String(cogsAccount._id), debit: 0, credit: cogs }
        );
      }
    }
    await createJournalEntry({
      tenant: scope,
      createdBy: actor,
      date: new Date(),
      memo: `Sale Invoice ${invoice.invoiceNumber} — cancelled`,
      lines: [
        { accountId: String(revenueAccount._id), debit: invoice.subtotal || 0, credit: 0 },
        ...vatLines,
        { accountId: String(accountsReceivable._id), debit: 0, credit: invoice.total || 0 },
        ...cogsLines,
      ],
    });
  }

  invoice.deliveryStatus = status as any;
  await invoice.save();
  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

// Records a payment, recomputes paymentStatus, posts the AR-clearing entry.
const addPayment = async (
  id: string,
  data: { date: string; amount: number; method?: string; reference?: string },
  filter: Record<string, unknown>,
  createdBy: string
): Promise<SaleInvoiceResult> => {
  const invoice = await SaleInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }

  const paidToDate = (invoice.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const creditedAmount = (await getCreditedAmounts([id])).get(id) || 0;
  const balanceDue = (invoice.total || 0) - creditedAmount - paidToDate;
  if (data.amount > balanceDue) {
    return { errorCode: "exceeds_balance", result: null };
  }

  const scope: TenantScope = {
    adminId: invoice.adminId ? String(invoice.adminId) : null,
    merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
  };

  const accountsReceivable = await ensureAccountsReceivable(scope, createdBy);
  const cashOrBank = await getCashOrBankAccount(scope, data.method);
  await createJournalEntry({
    tenant: scope,
    createdBy,
    date: new Date(data.date),
    memo: `Payment received — Invoice ${invoice.invoiceNumber}`,
    lines: [
      { accountId: String(cashOrBank._id), debit: data.amount, credit: 0 },
      { accountId: String(accountsReceivable._id), debit: 0, credit: data.amount },
    ],
  });

  invoice.paymentHistory = [
    ...(invoice.paymentHistory || []),
    { date: toDateOnly(data.date), amount: data.amount, method: data.method || null, reference: data.reference || null },
  ] as any;
  const newPaid = paidToDate + data.amount;
  invoice.paymentStatus = newPaid >= (invoice.total || 0) - creditedAmount ? "Paid" : "Partial";

  await invoice.save();
  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

// Records cash actually handed back to the customer — the other half of the
// return story addPayment doesn't cover. Only ever allowed up to whatever
// they're really owed right now (paid so far, net of credits already
// applied and any refund already paid out), recomputed fresh every call so
// two refunds in a row can never together exceed what's actually due.
const addRefund = async (
  id: string,
  data: { date: string; amount: number; method?: string; reference?: string },
  filter: Record<string, unknown>,
  createdBy: string
): Promise<SaleInvoiceResult> => {
  const invoice = await SaleInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }

  const paidToDate = (invoice.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const refundedToDate = (invoice.refundHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const creditedAmount = (await getCreditedAmounts([id])).get(id) || 0;
  const netTotal = (invoice.total || 0) - creditedAmount;
  const refundDue = paidToDate - netTotal - refundedToDate;
  if (data.amount > refundDue) {
    return { errorCode: "exceeds_refund", result: null };
  }

  const scope: TenantScope = {
    adminId: invoice.adminId ? String(invoice.adminId) : null,
    merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
  };

  const accountsReceivable = await ensureAccountsReceivable(scope, createdBy);
  const cashOrBank = await getCashOrBankAccount(scope, data.method);
  await createJournalEntry({
    tenant: scope,
    createdBy,
    date: new Date(data.date),
    memo: `Refund paid — Invoice ${invoice.invoiceNumber}`,
    lines: [
      { accountId: String(accountsReceivable._id), debit: data.amount, credit: 0 },
      { accountId: String(cashOrBank._id), debit: 0, credit: data.amount },
    ],
  });

  invoice.refundHistory = [
    ...(invoice.refundHistory || []),
    { date: toDateOnly(data.date), amount: data.amount, method: data.method || null, reference: data.reference || null },
  ] as any;

  await invoice.save();
  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

// Delete is allowed before stock leaves (Pending/InTransit) or after a
// Cancel. Delivered invoices stay — corrections go through a Credit Note.
// Legacy rows that already decremented stock at create still hand it back.
const deleteByID = async (id: string, filter: Record<string, unknown>, actor: string): Promise<SaleInvoiceResult> => {
  const invoice = await SaleInvoiceModel.findOne({ _id: id, ...filter }).lean();
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  if (
    invoice.deliveryStatus !== "Pending" &&
    invoice.deliveryStatus !== "InTransit" &&
    invoice.deliveryStatus !== "Cancelled"
  ) {
    return { errorCode: "invalid_status", result: null };
  }
  if (invoice.stockApplied) {
    const scope: TenantScope = {
      adminId: invoice.adminId ? String(invoice.adminId) : null,
      merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
    };
    await applyStockForProducts(
      scope,
      String(invoice.warehouseId),
      toStockLines(invoice.products || []),
      "add",
      `Sale Invoice ${invoice.invoiceNumber} — deleted`,
      actor
    );
  }
  await SaleInvoiceModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

export { create, getAll, get, getReceivables, getCollectedTaxReport, getRawByCustomer, update, updateDeliveryStatus, addPayment, addRefund, deleteByID, getCreditedAmounts, applyReturnFigures };
