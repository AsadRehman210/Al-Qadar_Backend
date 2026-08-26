import { ProductionOrderModel } from "../../model/inventory/production-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { WarehouseModel } from "../../model/warehouse/warehouse-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { productionOrderDto } from "../../utility/dtos/inventory/production-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/inventory/production-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { adjustStock, getStockByVariant, getStockMapForWarehouse } from "../warehouse/stock-level-service";
import { consumeBatch, addStockBatch } from "./stock-batch-service";
import { updateCostWeightedAverage } from "./variant-service";
import { toDateOnly } from "../../utility/helper/date-only";
import { createJournalEntry } from "../finance/journal-service";
import { ensureManufacturingOverheadExpense, ensureAccountsPayable } from "../../utility/helper/finance-accounts";

const POPULATE: [string, string][] = [
  ["outputVariantId", "variantName sku"],
  ["warehouseId", "name"],
  ["rawLines.variantId", "variantName sku costPrice"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) {
    await doc.populate(field, select);
  }
  return doc;
};

export interface ProductionListOptions {
  search?: string;
  status?: string;
  warehouseId?: string;
}

interface RawLineInput {
  variantId: string;
  quantity: number;
  actualQuantity?: number;
}

interface CreateProductionInput {
  scheduledDate?: string;
  outputVariantId: string;
  outputQuantity: number;
  warehouseId: string;
  notes?: string;
  rawLines: RawLineInput[];
  otherCostLines?: { label: string; amount: number }[];
}

export interface ProductionShortage {
  variantId: string;
  available: number;
  requested: number;
}

interface ProductionResult {
  errorCode: "success" | "not_found" | "invalid_status" | "variant_not_found" | "warehouse_not_found" | "insufficient_stock";
  result: productionOrderDto | null;
  shortages?: ProductionShortage[];
}

// FEFO-consumes qty out of whatever batches this variant/warehouse actually
// has — same helper duplicated in Stock Transfer/Issue's own services for
// the identical reasoning (keeps StockBatch.remainingQty in sync with the
// aggregate StockLevel a sibling adjustStock call just changed).
const consumeFefo = async (variantId: string, warehouseId: string, qty: number): Promise<void> => {
  const batches = await StockBatchModel.find({ variantId, warehouseId, remainingQty: { $gt: 0 } }).sort({ expiryDate: 1 }).lean();
  let remaining = qty;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(Number(batch.remainingQty) || 0, remaining);
    if (take <= 0) continue;
    await consumeBatch(String(batch._id), take);
    remaining -= take;
  }
};

const generateOrderNumber = async (tenant: TenantScope): Promise<string> => {
  const count = await ProductionOrderModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `PRD-${String(count + 1).padStart(6, "0")}`;
};

const create = async (
  data: CreateProductionInput,
  scope: TenantScope,
  createdBy: string
): Promise<ProductionResult> => {
  const warehouse = await WarehouseModel.findOne({ _id: data.warehouseId, adminId: scope.adminId, merchantId: scope.merchantId }).lean();
  if (!warehouse) {
    return { errorCode: "warehouse_not_found", result: null };
  }
  const variantIds = [data.outputVariantId, ...data.rawLines.map((l) => l.variantId)];
  const variantCount = await VariantModel.countDocuments({
    _id: { $in: variantIds },
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  });
  if (variantCount !== new Set(variantIds).size) {
    return { errorCode: "variant_not_found", result: null };
  }

  const orderNumber = await generateOrderNumber(scope);
  const order = await ProductionOrderModel.create({
    orderNumber,
    status: "Draft",
    scheduledDate: data.scheduledDate ? toDateOnly(data.scheduledDate) : null,
    outputVariantId: data.outputVariantId,
    outputQuantity: data.outputQuantity,
    warehouseId: data.warehouseId,
    notes: data.notes || null,
    rawLines: data.rawLines,
    otherCostLines: data.otherCostLines || [],
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await populateAll(order);
  return { errorCode: "success", result: mapDbToDto(order) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: ProductionListOptions = {}
): Promise<{ totalCount: number; result: productionOrderDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["orderNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status", warehouseId: "warehouseId" }),
  };

  let cursor = ProductionOrderModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await ProductionOrderModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<productionOrderDto | null> => {
  let cursor = ProductionOrderModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateProductionInput>,
  filter: Record<string, unknown>
): Promise<ProductionResult> => {
  const order = await ProductionOrderModel.findOne({ _id: id, ...filter });
  if (!order) {
    return { errorCode: "not_found", result: null };
  }
  if (order.status !== "Draft") {
    return { errorCode: "invalid_status", result: null };
  }

  if (data.scheduledDate !== undefined) order.scheduledDate = data.scheduledDate ? toDateOnly(data.scheduledDate) : null;
  if (data.outputVariantId !== undefined) order.outputVariantId = data.outputVariantId as any;
  if (data.outputQuantity !== undefined) order.outputQuantity = data.outputQuantity;
  if (data.warehouseId !== undefined) order.warehouseId = data.warehouseId as any;
  if (data.notes !== undefined) order.notes = data.notes;
  if (data.rawLines !== undefined) order.rawLines = data.rawLines as any;
  if (data.otherCostLines !== undefined) order.otherCostLines = data.otherCostLines as any;

  await order.save();
  await populateAll(order);
  return { errorCode: "success", result: mapDbToDto(order) };
};

// Consumes raw-material lines (subtract), produces the output variant (add),
// and recomputes the output's weighted-average cost — all guarded so it can
// only ever run once per order (status Draft/InProgress -> Completed).
// Scope for the stock/cost mutations is derived from the order's own
// adminId/merchantId, not the acting user — correct regardless of which
// role (admin/merchant/super_admin) triggers completion.
const complete = async (
  id: string,
  filter: Record<string, unknown>,
  actor: string
): Promise<ProductionResult> => {
  const order = await ProductionOrderModel.findOne({ _id: id, ...filter });
  if (!order) {
    return { errorCode: "not_found", result: null };
  }
  if (order.status === "Completed" || order.status === "Cancelled") {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: order.adminId ? String(order.adminId) : null,
    merchantId: order.merchantId ? String(order.merchantId) : null,
  };
  const warehouseId = String(order.warehouseId);

  // Checked up front, across all raw lines, before anything is consumed —
  // adjustStock's own subtract floors at 0 rather than failing, so without
  // this a shortage on any line would silently succeed: stock goes to 0,
  // the output still gets produced and costed as if the full quantity was
  // really consumed, and nothing tells the user it was short.
  const availableMap = await getStockMapForWarehouse(
    { adminId: scope.adminId, merchantId: scope.merchantId },
    warehouseId
  );
  const shortages: ProductionShortage[] = [];
  for (const line of order.rawLines || []) {
    const consumedQty = line.actualQuantity ?? line.quantity;
    const available = availableMap.get(String(line.variantId)) || 0;
    if (consumedQty > available) {
      shortages.push({ variantId: String(line.variantId), available, requested: consumedQty });
    }
  }
  if (shortages.length) {
    return { errorCode: "insufficient_stock", result: null, shortages };
  }

  let totalRawCost = 0;

  for (const line of order.rawLines || []) {
    const variant = await VariantModel.findById(line.variantId).lean();
    const consumedQty = line.actualQuantity ?? line.quantity;
    totalRawCost += consumedQty * (variant?.costPrice || 0);

    await adjustStock(
      scope,
      String(line.variantId),
      warehouseId,
      "subtract",
      consumedQty,
      `Production ${order.orderNumber} — raw material consumed`,
      actor
    );
    // Keeps batch history in sync with the aggregate total — same fix
    // applied to Credit/Debit Note and Stock Transfer/Issue this session.
    await consumeFefo(String(line.variantId), warehouseId, consumedQty);
  }

  const otherCostTotal = (order.otherCostLines || []).reduce((sum, l) => sum + (l.amount || 0), 0);
  const outputQty = order.outputQuantity || 0;
  const unitCostThisBatch = outputQty > 0 ? (totalRawCost + otherCostTotal) / outputQty : 0;

  const existingQty = await getStockByVariant(scope, String(order.outputVariantId));
  const newCost = await updateCostWeightedAverage(
    String(order.outputVariantId),
    existingQty,
    outputQty,
    unitCostThisBatch
  );

  await adjustStock(
    scope,
    String(order.outputVariantId),
    warehouseId,
    "add",
    outputQty,
    `Production ${order.orderNumber} — output produced`,
    actor
  );
  // Unlike Purchase Invoice's Received step, manufactured output previously
  // got no batch record at all — no FEFO/expiry tracking for produced
  // goods, and nothing for a future return flow to reference.
  if (outputQty > 0) {
    await addStockBatch(
      {
        variantId: String(order.outputVariantId),
        warehouseId,
        qty: outputQty,
        unitCost: unitCostThisBatch,
        sourceType: "Production",
        sourceRef: order.orderNumber || undefined,
      },
      scope
    );
  }

  // Labor/overhead was previously folded silently into the output's own
  // weighted-average cost with no Finance posting at all — real cost,
  // invisible to P&L. Treated as owed (not yet paid), same convention as
  // Purchase Invoice's own Dr Expense / Cr Accounts Payable at Received.
  if (otherCostTotal > 0) {
    const overheadAccount = await ensureManufacturingOverheadExpense(scope, actor);
    const accountsPayable = await ensureAccountsPayable(scope, actor);
    await createJournalEntry({
      tenant: scope,
      createdBy: actor,
      date: toDateOnly(new Date()),
      memo: `Production ${order.orderNumber} — labor & overhead`,
      lines: [
        { accountId: String(overheadAccount._id), debit: otherCostTotal, credit: 0 },
        { accountId: String(accountsPayable._id), debit: 0, credit: otherCostTotal },
      ],
    });
  }

  order.status = "Completed";
  order.completedDate = new Date();
  order.unitCost = newCost;
  await order.save();
  await populateAll(order);

  return { errorCode: "success", result: mapDbToDto(order) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<ProductionResult> => {
  const order = await ProductionOrderModel.findOne({ _id: id, ...filter }).lean();
  if (!order) {
    return { errorCode: "not_found", result: null };
  }
  if (order.status === "Completed") {
    return { errorCode: "invalid_status", result: null };
  }
  await ProductionOrderModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(order) };
};

export { create, getAll, get, update, complete, deleteByID };
