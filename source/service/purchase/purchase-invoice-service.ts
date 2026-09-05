import { PurchaseInvoiceModel } from "../../model/purchase/purchase-invoice-model";
import { DebitNoteModel } from "../../model/purchase/debit-note-model";
import { ChartOfAccountModel } from "../../model/finance/chart-of-account-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { purchaseInvoiceDto } from "../../utility/dtos/purchase/purchase-invoice-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/purchase/purchase-invoice-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { adjustStock, getStockByVariant } from "../warehouse/stock-level-service";
import { updateCostWeightedAverage } from "../inventory/variant-service";
import { addStockBatch, updateBatchExpiryBySource } from "../inventory/stock-batch-service";
import { createJournalEntry } from "../finance/journal-service";
import { ensureAccountsPayable, ensureVatReceivable, ensureInventory } from "../../utility/helper/finance-accounts";
import { toDateOnly, formatDateOnly } from "../../utility/helper/date-only";

const POPULATE: [string, string][] = [
  ["supplierId", "name"],
  ["warehouseId", "name"],
  ["products.variantId", "variantName sku"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) await doc.populate(field, select);
  return doc;
};

const getCashOrBankAccount = async (scope: TenantScope, method: string | undefined) => {
  const code = method === "Cash" ? "1000" : "1010";
  const account = await ChartOfAccountModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, code }).lean();
  if (!account) {
    throw new Error(`Chart of Accounts is missing code ${code} for this tenant.`);
  }
  return account;
};

// Only an Applied debit note is a real, financially-recognized debit —
// Draft/Approved haven't posted their journal entry yet, and Voided never
// will. Bulk version powers getAll (one query for a whole page).
const getDebitedAmounts = async (invoiceIds: string[]): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  if (!invoiceIds.length) return map;
  const notes = await DebitNoteModel.find({ originalInvoiceId: { $in: invoiceIds }, status: "Applied" }).lean();
  for (const note of notes) {
    const key = String(note.originalInvoiceId);
    map.set(key, (map.get(key) || 0) + (note.total || 0));
  }
  return map;
};

// Attaches debitedAmount/refundDue/refundedAmount onto an already-mapped
// dto — paymentHistory only ever holds real cash paid to the supplier (see
// debit-note-service.ts's updateStatus), so paidAmount here is pure cash.
// Floating-point subtraction across several payment/debit amounts can land
// a hair off zero — rounded to cents so a fully settled invoice never shows
// a phantom balance/refund due to binary float imprecision.
const round2 = (n: number): number => Math.round(n * 100) / 100;

const applyReturnFigures = (dto: purchaseInvoiceDto, debitedAmount: number): purchaseInvoiceDto => {
  const paidAmount = (dto.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const refundedAmount = (dto.refundHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const netTotal = (dto.total || 0) - debitedAmount;
  dto.debitedAmount = round2(debitedAmount);
  dto.balanceDue = round2(Math.max(0, netTotal - paidAmount));
  dto.refundDue = round2(Math.max(0, paidAmount - netTotal - refundedAmount));
  dto.refundedAmount = round2(refundedAmount);
  dto.paidAmount = round2(paidAmount);
  // paymentStatus recomputed here rather than trusted from the stored field
  // — see Sale Invoice's identical fix for the full reasoning. "Cleared" is
  // reserved for genuinely settled; a pending refund from the supplier keeps
  // it "Partial".
  if (paidAmount === 0) dto.paymentStatus = "Pending";
  else if (dto.balanceDue > 0 || dto.refundDue > 0) dto.paymentStatus = "Partial";
  else dto.paymentStatus = "Cleared";
  return dto;
};

export interface PurchaseInvoiceListOptions {
  search?: string;
  supplierId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

interface PurchaseLineInput {
  variantId: string;
  productName?: string;
  qty: number;
  price: number;
  unit?: string;
  expiryDate?: string;
  // undefined/null = use the invoice's own taxPercent; set = this line's
  // own override. See the model's IPurchaseLine comment for the same note.
  taxPercent?: number | null;
}

// Every line's own effective rate — its own override if set, otherwise the
// invoice-level rate. The single formula both "same for all" and "different
// per product" modes reduce to, so nothing downstream needs to know which
// mode the user was in.
const effectiveLineTaxPercent = (line: PurchaseLineInput, invoiceTaxPercent: number): number =>
  line.taxPercent !== undefined && line.taxPercent !== null ? line.taxPercent : invoiceTaxPercent;

interface CreatePurchaseInvoiceInput {
  supplierId: string;
  date: string;
  expectedDelivery?: string;
  warehouseId: string;
  receiverName?: string;
  productType?: string;
  products: PurchaseLineInput[];
  taxPercent?: number;
  // true (default) = a real recoverable input-VAT credit — landed unit cost
  // stays net-of-tax, tax posts to VAT Receivable at Received. false = a
  // blocked/non-recoverable cost — tax folds into the landed unit cost /
  // Inventory instead, no VAT Receivable line. Invoice-wide, set at creation, locked
  // once Received (see updateStatus).
  taxRecoverable?: boolean;
  notes?: string;
  currency?: string;
  status?: string;
}

interface PurchaseInvoiceResult {
  errorCode: "success" | "not_found" | "invalid_status" | "exceeds_balance" | "exceeds_refund";
  result: purchaseInvoiceDto | null;
}

const generateInvoiceNo = async (tenant: TenantScope): Promise<string> => {
  const count = await PurchaseInvoiceModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `PO-${String(count + 1).padStart(6, "0")}`;
};

const computeTotals = (products: PurchaseLineInput[], invoiceTaxPercent = 0) => {
  let subtotal = 0;
  let taxAmount = 0;
  for (const line of products) {
    const lineSubtotal = line.qty * line.price;
    subtotal += lineSubtotal;
    taxAmount += lineSubtotal * (effectiveLineTaxPercent(line, invoiceTaxPercent) / 100);
  }
  taxAmount = Math.round(taxAmount * 100) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

// Stamps each product's own computed taxAmount and landed unitCost (its
// effective rate applied to its own price/subtotal) directly onto the saved
// record — so every product is self-describing in the DB regardless of
// whether the invoice was entered in "same for all" or "different per
// product" mode, and regardless of whether it's been Received yet. The
// receive step (updateStatus) reuses this same unitCost for the stock batch
// instead of recomputing it, so two lines of the same variant at different
// prices always land as two distinct batch costs — never collapsed to one.
//
// unitCost only folds the tax in when it's NOT recoverable — a recoverable
// tax is going to VAT Receivable, not staying with the goods, so Stock's own
// landed cost should be net-of-tax; a non-recoverable tax is a real cost, so
// it stays part of the goods' cost exactly like before this field existed.
const withLineTaxAmounts = (products: PurchaseLineInput[], invoiceTaxPercent: number, taxRecoverable: boolean) =>
  products.map((line) => {
    const lineSubtotal = line.qty * line.price;
    const rate = effectiveLineTaxPercent(line, invoiceTaxPercent);
    const taxAmount = Math.round(lineSubtotal * (rate / 100) * 100) / 100;
    const unitCost = taxRecoverable
      ? Math.round(line.price * 100) / 100
      : Math.round(line.price * (1 + rate / 100) * 100) / 100;
    return { ...line, taxAmount, unitCost };
  });

// Draft/Ordered/Transit carry no liability yet — created freely, no ledger
// entry until Received (see updateStatus).
const create = async (
  data: CreatePurchaseInvoiceInput,
  scope: TenantScope,
  createdBy: string
): Promise<PurchaseInvoiceResult> => {
  const invoiceNumber = await generateInvoiceNo(scope);
  const taxRecoverable = data.taxRecoverable !== false;
  const { subtotal, taxAmount, total } = computeTotals(data.products, data.taxPercent || 0);

  const invoice = await PurchaseInvoiceModel.create({
    invoiceNumber,
    supplierId: data.supplierId,
    date: toDateOnly(data.date),
    expectedDelivery: data.expectedDelivery ? toDateOnly(data.expectedDelivery) : null,
    warehouseId: data.warehouseId,
    receiverName: data.receiverName || null,
    productType: data.productType || null,
    products: withLineTaxAmounts(data.products, data.taxPercent || 0, taxRecoverable),
    subtotal,
    taxPercent: data.taxPercent || 0,
    taxAmount,
    taxRecoverable,
    total,
    status: data.status || "Draft",
    stockApplied: false,
    paymentStatus: "Pending",
    paymentHistory: [],
    notes: data.notes || null,
    currency: data.currency || "SAR",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: PurchaseInvoiceListOptions = {}
): Promise<{ totalCount: number; result: purchaseInvoiceDto[] }> => {
  const startIndex = (page - 1) * limit;
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);

  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["invoiceNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { supplierId: "supplierId", status: "status" }),
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  let cursor = PurchaseInvoiceModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await PurchaseInvoiceModel.countDocuments(query);

  const result = mapDbListToDtoList(data);
  const debitedByInvoice = await getDebitedAmounts(result.map((r) => r.id));
  for (const dto of result) {
    applyReturnFigures(dto, debitedByInvoice.get(dto.id) || 0);
  }

  return { totalCount: count, result };
};

// Applied debit notes reverse the same VAT Receivable the original bill
// posted — grouped here so Recoverable Tax can net them off invoice.taxAmount
// instead of showing the frozen billed figure after a return.
const getAppliedReturnTaxByInvoice = async (
  invoiceIds: string[]
): Promise<Map<string, { tax: number; subtotal: number }>> => {
  const map = new Map<string, { tax: number; subtotal: number }>();
  if (!invoiceIds.length) return map;
  const notes = await DebitNoteModel.find({
    originalInvoiceId: { $in: invoiceIds },
    status: "Applied",
  }).select("originalInvoiceId taxAmount subtotal").lean();
  for (const note of notes) {
    const key = String(note.originalInvoiceId);
    const cur = map.get(key) || { tax: 0, subtotal: 0 };
    cur.tax = round2(cur.tax + (note.taxAmount || 0));
    cur.subtotal = round2(cur.subtotal + (note.subtotal || 0));
    map.set(key, cur);
  }
  return map;
};

// The "Recoverable Tax" module's own view — every Received invoice whose
// tax is a real input-VAT credit, net of Applied debit notes, with the
// headline total across every matching invoice (not just the current page).
const getRecoverableTaxReport = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { search?: string; supplierId?: string; fromDate?: string; toDate?: string } = {}
): Promise<{ totalCount: number; totalTaxAmount: number; result: purchaseInvoiceDto[] }> => {
  const dateFilter: Record<string, unknown> = {};
  if (options.fromDate) dateFilter.$gte = new Date(options.fromDate);
  if (options.toDate) dateFilter.$lte = new Date(options.toDate);

  const query = {
    ...filter,
    status: "Received",
    taxRecoverable: { $ne: false },
    taxAmount: { $gt: 0 },
    ...buildSearchCondition(options.search, ["invoiceNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { supplierId: "supplierId" }),
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  let cursor = PurchaseInvoiceModel.find(query).sort({ date: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const returnedByInvoice = await getAppliedReturnTaxByInvoice(data.map((inv) => String(inv._id)));

  const withNet = data
    .map((inv) => {
      const ret = returnedByInvoice.get(String(inv._id)) || { tax: 0, subtotal: 0 };
      return {
        inv,
        netTax: round2(Math.max(0, (inv.taxAmount || 0) - ret.tax)),
        netSubtotal: round2(Math.max(0, (inv.subtotal || 0) - ret.subtotal)),
        returnedTax: ret.tax,
      };
    })
    .filter((row) => row.netTax > 0);

  const startIndex = (page - 1) * limit;
  const result = withNet.slice(startIndex, startIndex + limit).map(({ inv, netTax, netSubtotal, returnedTax }) => {
    const dto = mapDbToDto(inv);
    dto.taxAmount = netTax;
    dto.subtotal = netSubtotal;
    dto.returnedTaxAmount = returnedTax;
    return dto;
  });

  return {
    totalCount: withNet.length,
    totalTaxAmount: round2(withNet.reduce((sum, row) => sum + row.netTax, 0)),
    result,
  };
};

// The real Accounts Payable view — every Purchase Invoice actually still
// owed to the supplier (balanceDue > 0) or owing a refund back from them
// (refundDue > 0), computed fresh off the same balanceDue/refundDue this
// session already built for the Detail page and list — not a separate
// manually-entered "Vendor Bill" record type. Mirrors Sale Invoice's own
// getReceivables exactly.
const getPayables = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { search?: string; supplierId?: string } = {}
): Promise<{ totalCount: number; totalBalanceDue: number; totalRefundDue: number; result: purchaseInvoiceDto[] }> => {
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["invoiceNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { supplierId: "supplierId" }),
  };

  let cursor = PurchaseInvoiceModel.find(query).sort({ date: 1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();

  const mapped = mapDbListToDtoList(data);
  const debitedByInvoice = await getDebitedAmounts(mapped.map((r) => r.id));
  for (const dto of mapped) applyReturnFigures(dto, debitedByInvoice.get(dto.id) || 0);

  const open = mapped.filter((d) => (d.balanceDue || 0) > 0 || (d.refundDue || 0) > 0);
  // Summing already-rounded per-invoice values can still drift a hair off —
  // rounded again after the sum, same reasoning as Sale Invoice's identical fix.
  const totalBalanceDue = round2(open.reduce((sum, d) => sum + (d.balanceDue || 0), 0));
  const totalRefundDue = round2(open.reduce((sum, d) => sum + (d.refundDue || 0), 0));

  const startIndex = (page - 1) * limit;
  const result = open.slice(startIndex, startIndex + limit);

  return { totalCount: open.length, totalBalanceDue, totalRefundDue, result };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<purchaseInvoiceDto | null> => {
  let cursor = PurchaseInvoiceModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  if (!data) return null;

  const dto = mapDbToDto(data);
  const debitNotes = await DebitNoteModel.find({ originalInvoiceId: id, status: { $ne: "Voided" } }).populate("products.variantId", "variantName").lean();
  applyReturnFigures(dto, debitNotes.filter((dn) => dn.status === "Applied").reduce((sum, dn) => sum + (dn.total || 0), 0));
  dto.returnedItems = debitNotes.flatMap((dn) =>
    (dn.products || []).map((line: any) => ({
      dnId: String(dn._id),
      dnNumber: dn.dnNumber || null,
      dnStatus: dn.status || null,
      date: formatDateOnly(dn.date),
      reason: dn.reason || null,
      variantId: String(line.variantId?._id || line.variantId),
      productName: line.productName || null,
      qty: line.qty,
      price: line.price,
      taxPercent:
        line.taxPercent !== undefined && line.taxPercent !== null ? line.taxPercent : dn.taxPercent ?? null,
      taxAmount: line.taxAmount ?? 0,
      lineTotal: round2((line.qty || 0) * (line.price || 0) + (line.taxAmount || 0)),
    }))
  );
  return dto;
};

const getRawBySupplier = async (supplierId: string, filter: Record<string, unknown>) => {
  return PurchaseInvoiceModel.find({ supplierId, ...filter });
};

const update = async (
  id: string,
  data: Partial<CreatePurchaseInvoiceInput>,
  filter: Record<string, unknown>
): Promise<PurchaseInvoiceResult> => {
  const invoice = await PurchaseInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  // Status itself is deliberately never touched here — it only ever changes
  // through updateStatus (the dedicated PATCH), which is what carries the
  // one-time stock/cost/journal side effects on -> Received. Everything
  // else on the invoice (supplier, dates, products, notes, ...) stays
  // editable even after Received; only the status transition is locked.

  // Captured before any field is touched — if this invoice was already
  // Received, its StockBatch rows were written against these values, and
  // that's what's needed below to find them again after products change.
  const wasReceived = invoice.stockApplied;
  const batchWarehouseId = String(invoice.warehouseId);
  const scope: TenantScope = {
    adminId: invoice.adminId ? String(invoice.adminId) : null,
    merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
  };

  if (data.supplierId !== undefined) invoice.supplierId = data.supplierId as any;
  if (data.date !== undefined) invoice.date = toDateOnly(data.date);
  if (data.expectedDelivery !== undefined) invoice.expectedDelivery = data.expectedDelivery ? toDateOnly(data.expectedDelivery) : null;
  if (data.warehouseId !== undefined) invoice.warehouseId = data.warehouseId as any;
  if (data.receiverName !== undefined) invoice.receiverName = data.receiverName;
  if (data.productType !== undefined) invoice.productType = data.productType;
  if (data.notes !== undefined) invoice.notes = data.notes;
  if (data.taxRecoverable !== undefined) invoice.taxRecoverable = data.taxRecoverable;
  if (data.products !== undefined) {
    const effectiveTaxPercent = data.taxPercent ?? invoice.taxPercent ?? 0;
    const effectiveTaxRecoverable = invoice.taxRecoverable !== false;
    const { subtotal, taxAmount, total } = computeTotals(data.products, effectiveTaxPercent);
    invoice.products = withLineTaxAmounts(data.products, effectiveTaxPercent, effectiveTaxRecoverable) as any;
    invoice.taxPercent = effectiveTaxPercent;
    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.total = total;
  }

  await invoice.save();

  // A line's expiryDate can still be edited after Received (see the comment
  // above), but the StockBatch row that Received already wrote never picks
  // that up on its own — sync it here so what Stock shows always matches
  // what the invoice now says. Matched by (variant, warehouse, sourceRef),
  // same key addStockBatch stamped the row with originally.
  if (wasReceived && data.products !== undefined) {
    for (const line of data.products) {
      await updateBatchExpiryBySource(
        scope,
        String(line.variantId),
        batchWarehouseId,
        "Purchase Invoice",
        invoice.invoiceNumber || "",
        line.expiryDate
      );
    }
  }

  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

// Draft -> Ordered -> Transit -> Received. Received is the single moment
// stock increases, the output variant's weighted-average cost updates, a
// batch record is written, and the AP/Inventory journal entry posts — guarded by
// stockApplied so it can only ever fire once.
const updateStatus = async (
  id: string,
  status: string,
  filter: Record<string, unknown>,
  actor: string
): Promise<PurchaseInvoiceResult> => {
  const invoice = await PurchaseInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  // Once Received, the stock/cost/journal effects below have already fired —
  // moving back to any earlier stage would leave them stranded (stock added,
  // no way to reverse it here), so the status itself is locked at that point.
  if (invoice.status === "Received" && status !== "Received") {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: invoice.adminId ? String(invoice.adminId) : null,
    merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
  };

  if (status === "Received" && !invoice.stockApplied) {
    // Each line's landed per-unit cost was already computed and saved on
    // create/update (see withLineTaxAmounts) — reused as-is here rather than
    // recomputed, so what gets weighted-averaged into Variant.costPrice and
    // stamped on the batch always matches what was shown/saved earlier.
    // Falls back to computing it fresh only for legacy lines saved before
    // unitCost existed.
    for (const line of invoice.products || []) {
      const rate = effectiveLineTaxPercent(line as unknown as PurchaseLineInput, invoice.taxPercent || 0);
      const landedUnitCost = line.unitCost ?? Math.round(line.price * (1 + rate / 100) * 100) / 100;
      const existingQty = await getStockByVariant(scope, String(line.variantId));
      await updateCostWeightedAverage(String(line.variantId), existingQty, line.qty, landedUnitCost);

      await adjustStock(
        scope,
        String(line.variantId),
        String(invoice.warehouseId),
        "add",
        line.qty,
        `Purchase Invoice ${invoice.invoiceNumber} — received`,
        actor
      );

      await addStockBatch(
        {
          variantId: String(line.variantId),
          warehouseId: String(invoice.warehouseId),
          qty: line.qty,
          unitCost: landedUnitCost,
          expiryDate: line.expiryDate ? new Date(line.expiryDate).toISOString() : undefined,
          sourceType: "Purchase Invoice",
          sourceRef: invoice.invoiceNumber || undefined,
        },
        scope
      );
    }

    const accountsPayable = await ensureAccountsPayable(scope, actor);
    const inventoryAccount = await ensureInventory(scope, actor);
    // Recoverable (default): tax is a real input-VAT credit — debited to
    // VAT Receivable, separate from Inventory. Non-recoverable: the tax is a
    // real cost with nowhere else to go, so it stays folded into Inventory
    // instead — no VAT Receivable line at all. Either way Inventory + VAT
    // debit == AP credit, so the entry always balances. COGS is recognized
    // later, when the goods are actually sold.
    const taxRecoverable = invoice.taxRecoverable !== false;
    const vatLines = [];
    let inventoryDebit = invoice.subtotal || 0;
    if (invoice.taxAmount) {
      if (taxRecoverable) {
        const vatReceivable = await ensureVatReceivable(scope, actor);
        vatLines.push({ accountId: String(vatReceivable._id), debit: invoice.taxAmount, credit: 0 });
      } else {
        inventoryDebit += invoice.taxAmount;
      }
    }
    await createJournalEntry({
      tenant: scope,
      createdBy: actor,
      date: new Date(),
      memo: `Purchase Invoice ${invoice.invoiceNumber}`,
      lines: [
        { accountId: String(inventoryAccount._id), debit: inventoryDebit, credit: 0 },
        ...vatLines,
        { accountId: String(accountsPayable._id), debit: 0, credit: invoice.total || 0 },
      ],
    });

    invoice.stockApplied = true;
    invoice.receivedDate = toDateOnly(new Date());
  }

  invoice.status = status as any;
  await invoice.save();
  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

const addPayment = async (
  id: string,
  data: { date: string; amount: number; method?: string; reference?: string },
  filter: Record<string, unknown>,
  createdBy: string
): Promise<PurchaseInvoiceResult> => {
  const invoice = await PurchaseInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }

  const paidToDate = (invoice.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const debitedAmount = (await getDebitedAmounts([id])).get(id) || 0;
  const balanceDue = (invoice.total || 0) - debitedAmount - paidToDate;
  if (data.amount > balanceDue) {
    return { errorCode: "exceeds_balance", result: null };
  }

  const scope: TenantScope = {
    adminId: invoice.adminId ? String(invoice.adminId) : null,
    merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
  };

  const accountsPayable = await ensureAccountsPayable(scope, createdBy);
  const cashOrBank = await getCashOrBankAccount(scope, data.method);
  await createJournalEntry({
    tenant: scope,
    createdBy,
    date: new Date(data.date),
    memo: `Payment sent — Purchase Invoice ${invoice.invoiceNumber}`,
    lines: [
      { accountId: String(accountsPayable._id), debit: data.amount, credit: 0 },
      { accountId: String(cashOrBank._id), debit: 0, credit: data.amount },
    ],
  });

  invoice.paymentHistory = [
    ...(invoice.paymentHistory || []),
    { date: toDateOnly(data.date), amount: data.amount, method: data.method || null, reference: data.reference || null },
  ] as any;
  const newPaid = paidToDate + data.amount;
  invoice.paymentStatus = newPaid >= (invoice.total || 0) - debitedAmount ? "Cleared" : "Partial";

  await invoice.save();
  await populateAll(invoice);
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

// Records cash actually received back from the supplier — the other half of
// the return story addPayment doesn't cover. Only ever allowed up to
// whatever's really owed right now (paid so far, net of debits already
// applied and any refund already received), recomputed fresh every call.
const addRefund = async (
  id: string,
  data: { date: string; amount: number; method?: string; reference?: string },
  filter: Record<string, unknown>,
  createdBy: string
): Promise<PurchaseInvoiceResult> => {
  const invoice = await PurchaseInvoiceModel.findOne({ _id: id, ...filter });
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }

  const paidToDate = (invoice.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const refundedToDate = (invoice.refundHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const debitedAmount = (await getDebitedAmounts([id])).get(id) || 0;
  const netTotal = (invoice.total || 0) - debitedAmount;
  const refundDue = paidToDate - netTotal - refundedToDate;
  if (data.amount > refundDue) {
    return { errorCode: "exceeds_refund", result: null };
  }

  const scope: TenantScope = {
    adminId: invoice.adminId ? String(invoice.adminId) : null,
    merchantId: invoice.merchantId ? String(invoice.merchantId) : null,
  };

  const accountsPayable = await ensureAccountsPayable(scope, createdBy);
  const cashOrBank = await getCashOrBankAccount(scope, data.method);
  await createJournalEntry({
    tenant: scope,
    createdBy,
    date: new Date(data.date),
    memo: `Refund received — Purchase Invoice ${invoice.invoiceNumber}`,
    lines: [
      { accountId: String(cashOrBank._id), debit: data.amount, credit: 0 },
      { accountId: String(accountsPayable._id), debit: 0, credit: data.amount },
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

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<PurchaseInvoiceResult> => {
  const invoice = await PurchaseInvoiceModel.findOne({ _id: id, ...filter }).lean();
  if (!invoice) {
    return { errorCode: "not_found", result: null };
  }
  if (invoice.stockApplied) {
    return { errorCode: "invalid_status", result: null };
  }
  await PurchaseInvoiceModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(invoice) };
};

export { create, getAll, get, getPayables, getRecoverableTaxReport, getRawBySupplier, update, updateStatus, addPayment, addRefund, deleteByID, getDebitedAmounts, applyReturnFigures };
