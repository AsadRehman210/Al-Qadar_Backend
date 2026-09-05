import { DebitNoteModel } from "../../model/purchase/debit-note-model";
import { PurchaseInvoiceModel } from "../../model/purchase/purchase-invoice-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { debitNoteDto } from "../../utility/dtos/purchase/debit-note-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/purchase/debit-note-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { adjustStock } from "../warehouse/stock-level-service";
import { consumeBatch } from "../inventory/stock-batch-service";
import { createJournalEntry } from "../finance/journal-service";
import { ensureAccountsPayable, ensureVatReceivable, ensureInventory } from "../../utility/helper/finance-accounts";
import { toDateOnly, formatDateOnly } from "../../utility/helper/date-only";

const POPULATE: [string, string][] = [
  ["supplierId", "name"],
  ["warehouseId", "name"],
  ["originalInvoiceId", "invoiceNumber"],
  ["products.variantId", "variantName sku"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) await doc.populate(field, select);
  return doc;
};

export interface DebitNoteListOptions {
  search?: string;
  supplierId?: string;
  status?: string;
}

interface DebitNoteLineInput {
  variantId: string;
  productName?: string;
  qty: number;
  price: number;
  unit?: string;
  batchId?: string | null;
  expiryDate?: string | Date | null;
  taxPercent?: number | null;
}

interface ReturnableLine {
  variantId: string;
  productName: string | null;
  price: number;
  unitCost: number;
  unit: string;
  batchId: string | null;
  expiryDate: string | null;
  taxPercent: number | null;
  soldQty: number;
  alreadyDebitedQty: number;
  maxReturnableQty: number;
}

interface CreateDebitNoteInput {
  supplierId: string;
  date: string;
  originalInvoiceId: string;
  warehouseId: string;
  reason?: string;
  products: DebitNoteLineInput[];
  discount?: number;
  taxPercent?: number;
  notes?: string;
  currency?: string;
}

interface DebitNoteResult {
  errorCode:
    | "success"
    | "not_found"
    | "invalid_status"
    | "invoice_not_found"
    | "supplier_mismatch"
    | "exceeds_line_qty";
  result: debitNoteDto | null;
  overReturns?: { variantId: string; requestedQty: number; maxReturnableQty: number }[];
}

// "Price discrepancy" / "Wrong entry" are pure billing corrections — no
// physical item ever moved. "Short shipment" means the goods were never
// actually received into stock in the first place (the invoice overcharged
// for undelivered qty), so there's nothing to remove either. Every other
// reason means stock that WAS received is now physically going back to the
// supplier.
const NO_STOCK_MOVEMENT_REASONS = new Set(["Price discrepancy", "Short shipment", "Wrong entry"]);

const lineKey = (variantId: unknown) => String(variantId);

const getAlreadyDebitedMap = async (originalInvoiceId: string): Promise<Map<string, number>> => {
  const existingDebitNotes = await DebitNoteModel.find({
    originalInvoiceId,
    status: { $ne: "Voided" },
  }).lean();
  const map = new Map<string, number>();
  for (const note of existingDebitNotes) {
    for (const line of note.products || []) {
      const key = lineKey(line.variantId);
      map.set(key, (map.get(key) || 0) + (line.qty || 0));
    }
  }
  return map;
};

const generateDnNo = async (tenant: TenantScope): Promise<string> => {
  const count = await DebitNoteModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `DN-${String(count + 1).padStart(6, "0")}`;
};

// A line's own tax rate if it's carrying an override, otherwise the shared
// debit note-level rate — mirrors Purchase Invoice's own effectiveLineTaxPercent.
const effectiveLineTaxPercent = (line: { taxPercent?: number | null }, dnTaxPercent: number) =>
  line.taxPercent !== undefined && line.taxPercent !== null ? Number(line.taxPercent) || 0 : Number(dnTaxPercent) || 0;

const buildLines = (products: DebitNoteLineInput[], dnTaxPercent: number) =>
  products.map((line) => {
    const lineSubtotal = line.qty * line.price;
    const rate = effectiveLineTaxPercent(line, dnTaxPercent);
    const taxAmount = Math.round(lineSubtotal * (rate / 100) * 100) / 100;
    const unitCost = Math.round(line.price * (1 + rate / 100) * 100) / 100;
    return {
      variantId: line.variantId,
      productName: line.productName || null,
      qty: line.qty,
      price: line.price,
      unit: line.unit || "pcs",
      batchId: line.batchId || null,
      expiryDate: line.expiryDate ? toDateOnly(line.expiryDate) : null,
      taxPercent: line.taxPercent ?? null,
      taxAmount,
      unitCost,
    };
  });

// Discount is a flat deduction off the gross line total, applied only at the
// debit note level — Purchase Invoice itself carries no discount field, so
// there's no existing per-line convention to mirror; it does not get
// allocated back across each line's own tax computation.
const computeTotals = (lines: { qty: number; price: number; taxAmount?: number | null }[], discount = 0) => {
  const gross = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const subtotal = gross - discount;
  const taxAmount = Math.round(lines.reduce((sum, l) => sum + (l.taxAmount || 0), 0) * 100) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

const create = async (
  data: CreateDebitNoteInput,
  scope: TenantScope,
  createdBy: string
): Promise<DebitNoteResult> => {
  const originalInvoice = await PurchaseInvoiceModel.findOne({
    _id: data.originalInvoiceId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  }).lean();
  if (!originalInvoice) {
    return { errorCode: "invoice_not_found", result: null };
  }
  if (String(originalInvoice.supplierId) !== String(data.supplierId)) {
    return { errorCode: "supplier_mismatch", result: null };
  }

  // A debit note can never debit more of a line than was actually invoiced
  // on it, net of whatever's already been debited by other (non-Voided)
  // debit notes against the same purchase invoice line.
  const soldByKey = new Map<string, number>();
  for (const line of originalInvoice.products || []) {
    const key = lineKey(line.variantId);
    soldByKey.set(key, (soldByKey.get(key) || 0) + (line.qty || 0));
  }
  const debitedByKey = await getAlreadyDebitedMap(data.originalInvoiceId);
  const overReturns: { variantId: string; requestedQty: number; maxReturnableQty: number }[] = [];
  for (const line of data.products) {
    const key = lineKey(line.variantId);
    const remaining = (soldByKey.get(key) || 0) - (debitedByKey.get(key) || 0);
    if (line.qty > remaining) {
      overReturns.push({ variantId: line.variantId, requestedQty: line.qty, maxReturnableQty: Math.max(0, remaining) });
    }
  }
  if (overReturns.length) {
    return { errorCode: "exceeds_line_qty", result: null, overReturns };
  }

  const lines = buildLines(data.products, data.taxPercent || 0);
  const { subtotal, taxAmount, total } = computeTotals(lines, data.discount || 0);

  const dnNumber = await generateDnNo(scope);

  const dn = await DebitNoteModel.create({
    dnNumber,
    supplierId: data.supplierId,
    date: toDateOnly(data.date),
    originalInvoiceId: data.originalInvoiceId,
    warehouseId: data.warehouseId,
    reason: data.reason || null,
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
  await populateAll(dn);
  return { errorCode: "success", result: mapDbToDto(dn) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: DebitNoteListOptions = {}
): Promise<{ totalCount: number; result: debitNoteDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["dnNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { supplierId: "supplierId", status: "status" }),
  };

  let cursor = DebitNoteModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await DebitNoteModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<debitNoteDto | null> => {
  let cursor = DebitNoteModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  if (!data) return null;

  const dto = mapDbToDto(data);
  const invoiceId = data.originalInvoiceId ? String((data.originalInvoiceId as any)._id || data.originalInvoiceId) : null;
  if (!invoiceId || !dto.products?.length) return dto;

  const invoice = await PurchaseInvoiceModel.findById(invoiceId).select("products").lean();
  const billedByKey = new Map<string, number>();
  for (const line of invoice?.products || []) {
    const key = lineKey(line.variantId);
    billedByKey.set(key, (billedByKey.get(key) || 0) + (line.qty || 0));
  }

  // Only notes that existed before this one — later returns must not inflate
  // "already debited" on an earlier DN (both would otherwise show 5/5).
  const others = await DebitNoteModel.find({
    originalInvoiceId: invoiceId,
    status: { $ne: "Voided" },
    _id: { $ne: data._id },
    $or: [
      { createdAt: { $lt: data.createdAt } },
      { createdAt: data.createdAt, dnNumber: { $lt: data.dnNumber } },
    ],
  }).select("products").lean();
  const alreadyByKey = new Map<string, number>();
  for (const note of others) {
    for (const line of note.products || []) {
      const key = lineKey(line.variantId);
      alreadyByKey.set(key, (alreadyByKey.get(key) || 0) + (line.qty || 0));
    }
  }

  dto.products = dto.products.map((line) => ({
    ...line,
    billedQty: billedByKey.get(line.variantId) ?? 0,
    alreadyDebitedQty: alreadyByKey.get(line.variantId) ?? 0,
  }));
  return dto;
};

// What the Add Debit Note form actually renders: the original purchase
// invoice's own line items, each annotated with how much of it is still
// debitable — a debit note's lines are never a free product pick, only ever
// "some or all of what this invoice actually billed."
const getReturnableLines = async (
  invoiceId: string,
  filter: Record<string, unknown>
): Promise<{
  errorCode: "success" | "not_found";
  invoice: { id: string; invoiceNumber: string | null; supplierId: string | null; supplierName: string | null; warehouseId: string | null; warehouseName: string | null; currency: string; taxPercent: number } | null;
  lines: ReturnableLine[];
}> => {
  const invoice = await PurchaseInvoiceModel.findOne({ _id: invoiceId, ...filter })
    .populate("supplierId", "name")
    .populate("warehouseId", "name")
    .lean();
  if (!invoice) {
    return { errorCode: "not_found", invoice: null, lines: [] };
  }

  const debitedByKey = await getAlreadyDebitedMap(invoiceId);

  // Each Received purchase line becomes exactly one StockBatch (see
  // purchase-invoice-service.ts's updateStatus), tagged with this invoice as
  // its source — found here so a return can point at the same batch its
  // remainingQty needs to come back out of, instead of only adjusting the
  // aggregate StockLevel and leaving batch history stale.
  const batches = await StockBatchModel.find({
    warehouseId: invoice.warehouseId,
    sourceType: "Purchase Invoice",
    sourceRef: invoice.invoiceNumber,
  }).lean();
  const batchByVariant = new Map<string, string>();
  for (const batch of batches) {
    const key = String(batch.variantId);
    if (!batchByVariant.has(key)) batchByVariant.set(key, String(batch._id));
  }

  const lines: ReturnableLine[] = (invoice.products || []).map((line: any) => {
    const key = lineKey(line.variantId);
    const soldQty = line.qty || 0;
    const alreadyDebitedQty = debitedByKey.get(key) || 0;
    return {
      variantId: String(line.variantId),
      productName: line.productName || null,
      price: line.price,
      unitCost: line.unitCost ?? 0,
      unit: line.unit || "pcs",
      batchId: batchByVariant.get(key) || null,
      expiryDate: formatDateOnly(line.expiryDate),
      taxPercent: line.taxPercent ?? null,
      soldQty,
      alreadyDebitedQty,
      maxReturnableQty: Math.max(0, soldQty - alreadyDebitedQty),
    };
  });

  const supplier = invoice.supplierId as any;
  const warehouse = invoice.warehouseId as any;
  return {
    errorCode: "success",
    invoice: {
      id: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber || null,
      supplierId: supplier?._id ? String(supplier._id) : supplier ? String(supplier) : null,
      supplierName: supplier?.name || null,
      warehouseId: warehouse?._id ? String(warehouse._id) : warehouse ? String(warehouse) : null,
      warehouseName: warehouse?.name || null,
      currency: invoice.currency || "SAR",
      // The invoice's own flat rate — used to default the debit note's own
      // taxPercent instead of a hardcoded guess.
      taxPercent: invoice.taxPercent ?? 0,
    },
    lines,
  };
};

// Draft -> Approved -> Applied, with Voided reachable from Draft/Approved
// (mirrors Purchase/Sale's own terminal-lock pattern: once real financial/
// stock effects fire, status can't move away from Applied). Applied is the
// single moment stock leaves (goods returned to supplier, reason permitting)
// and the original invoice's payable balance is debited — guarded by
// stockApplied so it can only ever fire once.
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
): Promise<DebitNoteResult> => {
  const dn = await DebitNoteModel.findOne({ _id: id, ...filter });
  if (!dn) {
    return { errorCode: "not_found", result: null };
  }

  const allowed = VALID_NEXT_STATUS[dn.status || "Draft"] || [];
  if (!allowed.includes(status)) {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: dn.adminId ? String(dn.adminId) : null,
    merchantId: dn.merchantId ? String(dn.merchantId) : null,
  };

  if (status === "Applied" && !dn.stockApplied) {
    if (!NO_STOCK_MOVEMENT_REASONS.has(dn.reason || "")) {
      for (const line of dn.products || []) {
        await adjustStock(
          scope,
          String(line.variantId),
          String(dn.warehouseId),
          "subtract",
          line.qty,
          `Debit Note ${dn.dnNumber} — returned to supplier`,
          actor
        );
        // Keeps the specific batch's own remainingQty in sync with the
        // aggregate StockLevel total — without this, Stock Detail's batch
        // history keeps showing the pre-return quantity even though the
        // warehouse total already dropped.
        if (line.batchId) {
          await consumeBatch(String(line.batchId), line.qty);
        }
      }
    }

    const accountsPayable = await ensureAccountsPayable(scope, actor);
    const inventoryAccount = await ensureInventory(scope, actor);
    // Mirror the original purchase's tax treatment so a return unwinds the
    // same accounts: recoverable tax credits VAT Receivable; non-recoverable
    // tax was inside Inventory and comes back out of Inventory.
    const original = dn.originalInvoiceId
      ? await PurchaseInvoiceModel.findById(dn.originalInvoiceId).select("taxRecoverable").lean()
      : null;
    const taxRecoverable = original?.taxRecoverable !== false;
    const vatLines = [];
    let inventoryCredit = dn.subtotal || 0;
    if (dn.taxAmount) {
      if (taxRecoverable) {
        const vatReceivable = await ensureVatReceivable(scope, actor);
        vatLines.push({ accountId: String(vatReceivable._id), debit: 0, credit: dn.taxAmount });
      } else {
        inventoryCredit += dn.taxAmount;
      }
    }
    await createJournalEntry({
      tenant: scope,
      createdBy: actor,
      date: toDateOnly(new Date()),
      memo: `Debit Note ${dn.dnNumber} — ${dn.reason || "return"}`,
      lines: [
        { accountId: String(accountsPayable._id), debit: dn.total || 0, credit: 0 },
        { accountId: String(inventoryAccount._id), debit: 0, credit: inventoryCredit },
        ...vatLines,
      ],
    });

    // The original invoice's own paymentHistory is never touched here — a
    // return is not a cash payment. Purchase Invoice derives debitedAmount/
    // refundDue straight from this collection instead (see getDebitedAmounts
    // in purchase-invoice-service.ts), and any real cash received back from
    // the supplier is its own separate act (addRefund).

    dn.stockApplied = true;
    dn.approvedBy = actor as any;
  }

  dn.status = status as any;
  await dn.save();
  await populateAll(dn);
  return { errorCode: "success", result: mapDbToDto(dn) };
};

export { create, getAll, get, getReturnableLines, updateStatus };
