import { QuotationModel } from "../../model/sales/quotation-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { quotationDto } from "../../utility/dtos/sales/quotation-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/sales/quotation-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

const POPULATE: [string, string][] = [
  ["customerId", "name"],
  ["warehouseId", "name"],
  ["lines.variantId", "variantName sku"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) await doc.populate(field, select);
  return doc;
};

export interface QuotationListOptions {
  search?: string;
  customerId?: string;
  status?: string;
}

interface QuoteLineInput {
  variantId: string;
  productName?: string;
  qty: number;
  price: number;
  unit?: string;
  // Which batch this line was quoted against — reference only (costing,
  // expiry). Never reserved/consumed here; a quotation never moves stock.
  batchId?: string;
  // undefined/null = use the quotation's own taxPercent; set = this line's
  // own override. Same "same for all" vs "different per product" flow as
  // Sale/Purchase Invoice.
  taxPercent?: number | null;
}

// Every line's own effective rate — its own override if set, otherwise the
// invoice-level rate. Mirrors Sale/Purchase Invoice's identical helper exactly.
const effectiveLineTaxPercent = (line: { taxPercent?: number | null }, invoiceTaxPercent: number): number =>
  line.taxPercent !== undefined && line.taxPercent !== null ? line.taxPercent : invoiceTaxPercent;

interface CreateQuotationInput {
  customerId: string;
  date: string;
  validUntil?: string;
  warehouseId: string;
  lines: QuoteLineInput[];
  taxPercent?: number;
  notes?: string;
  currency?: string;
}

interface QuotationResult {
  errorCode: "success" | "not_found" | "invalid_status" | "already_converted";
  result: quotationDto | null;
}

const generateQuoteNo = async (tenant: TenantScope): Promise<string> => {
  const count = await QuotationModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `QUO-${String(count + 1).padStart(6, "0")}`;
};

// Snapshots each line's current Variant/batch cost at build time (never
// re-reads it later) so a quotation's own numbers never drift if the
// catalog price changes afterwards — same reasoning as Sale Invoice's
// buildLines, but this one never touches StockBatch/StockLevel documents:
// a quotation's batch pick is reference-only (costing/expiry) until it's
// actually converted, at which point Sale Invoice's own create() is what
// validates and consumes it for real. Also stamps each line's own computed
// taxAmount — same "same for all"/"different per product" flow as
// Sale/Purchase Invoice.
const buildLines = async (lines: QuoteLineInput[], invoiceTaxPercent = 0) => {
  const variantIds = lines.map((l) => l.variantId);
  const variants = await VariantModel.find({ _id: { $in: variantIds } }).lean();
  const byId = new Map(variants.map((v) => [String(v._id), v]));

  const batchIds = lines.map((l) => l.batchId).filter((id): id is string => Boolean(id));
  const batches = batchIds.length ? await StockBatchModel.find({ _id: { $in: batchIds } }).lean() : [];
  const batchById = new Map(batches.map((b) => [String(b._id), b]));

  return lines.map((line) => {
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
      expiryDate: batch?.expiryDate || null,
      taxPercent: line.taxPercent ?? null,
      taxAmount,
    };
  });
};

const computeTotals = (lines: { qty: number; price: number; taxAmount?: number | null }[]) => {
  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const taxAmount = Math.round(lines.reduce((sum, l) => sum + (l.taxAmount || 0), 0) * 100) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

const create = async (
  data: CreateQuotationInput,
  scope: TenantScope,
  createdBy: string
): Promise<QuotationResult> => {
  const quoteNumber = await generateQuoteNo(scope);
  const lines = await buildLines(data.lines, data.taxPercent || 0);
  const { subtotal, taxAmount, total } = computeTotals(lines);

  const quotation = await QuotationModel.create({
    quoteNumber,
    customerId: data.customerId,
    date: new Date(data.date),
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
    warehouseId: data.warehouseId,
    lines,
    subtotal,
    taxPercent: data.taxPercent || 0,
    taxAmount,
    total,
    currency: data.currency || "SAR",
    status: "Draft",
    notes: data.notes || null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await populateAll(quotation);
  return { errorCode: "success", result: mapDbToDto(quotation) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: QuotationListOptions = {}
): Promise<{ totalCount: number; result: quotationDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["quoteNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { customerId: "customerId", status: "status" }),
  };

  let cursor = QuotationModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await QuotationModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<quotationDto | null> => {
  let cursor = QuotationModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateQuotationInput>,
  filter: Record<string, unknown>
): Promise<QuotationResult> => {
  const quotation = await QuotationModel.findOne({ _id: id, ...filter });
  if (!quotation) {
    return { errorCode: "not_found", result: null };
  }
  if (quotation.status !== "Draft") {
    return { errorCode: "invalid_status", result: null };
  }

  if (data.customerId !== undefined) quotation.customerId = data.customerId as any;
  if (data.date !== undefined) quotation.date = new Date(data.date);
  if (data.validUntil !== undefined) quotation.validUntil = data.validUntil ? new Date(data.validUntil) : null;
  if (data.warehouseId !== undefined) quotation.warehouseId = data.warehouseId as any;
  if (data.notes !== undefined) quotation.notes = data.notes;
  if (data.lines !== undefined) {
    const effectiveTaxPercent = data.taxPercent ?? quotation.taxPercent ?? 0;
    const lines = await buildLines(data.lines, effectiveTaxPercent);
    const { subtotal, taxAmount, total } = computeTotals(lines);
    quotation.lines = lines as any;
    quotation.taxPercent = effectiveTaxPercent;
    quotation.subtotal = subtotal;
    quotation.taxAmount = taxAmount;
    quotation.total = total;
  }

  await quotation.save();
  await populateAll(quotation);
  return { errorCode: "success", result: mapDbToDto(quotation) };
};

const updateStatus = async (
  id: string,
  status: string,
  filter: Record<string, unknown>
): Promise<QuotationResult> => {
  const quotation = await QuotationModel.findOne({ _id: id, ...filter });
  if (!quotation) {
    return { errorCode: "not_found", result: null };
  }
  if (quotation.status === "Converted") {
    return { errorCode: "already_converted", result: null };
  }
  quotation.status = status as any;
  await quotation.save();
  await populateAll(quotation);
  return { errorCode: "success", result: mapDbToDto(quotation) };
};

// Conversion is a manual flow — the frontend sends the user to a prefilled
// Add Sale Invoice form where every other field (customer, warehouse,
// product, qty, price, tax) is locked to what was quoted, and only each
// line's batch stays editable, since stock may have moved since the quote
// was made. That form's own create() call is what actually validates and
// consumes the batch/stock for real (rejecting the save if the picked batch
// no longer has enough left) — nothing here ever guesses or reserves
// anything on the quote's behalf. Once that form is submitted and a real
// SaleInvoice exists, this just links the two records together — guarded so
// a quote can only ever be marked Converted once.
const markConverted = async (
  id: string,
  invoiceId: string,
  filter: Record<string, unknown>
): Promise<QuotationResult> => {
  const quotation = await QuotationModel.findOne({ _id: id, ...filter });
  if (!quotation) {
    return { errorCode: "not_found", result: null };
  }
  if (quotation.status === "Converted") {
    return { errorCode: "already_converted", result: null };
  }

  quotation.status = "Converted";
  quotation.convertedInvoiceId = invoiceId as any;
  await quotation.save();
  await populateAll(quotation);

  return { errorCode: "success", result: mapDbToDto(quotation) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<QuotationResult> => {
  const quotation = await QuotationModel.findOne({ _id: id, ...filter }).lean();
  if (!quotation) {
    return { errorCode: "not_found", result: null };
  }
  if (quotation.status === "Converted") {
    return { errorCode: "invalid_status", result: null };
  }
  await QuotationModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(quotation) };
};

export { create, getAll, get, update, updateStatus, markConverted, deleteByID };
