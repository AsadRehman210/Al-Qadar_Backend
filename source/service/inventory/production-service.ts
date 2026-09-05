import { ProductionOrderModel } from "../../model/inventory/production-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { WarehouseModel } from "../../model/warehouse/warehouse-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { productionOrderDto } from "../../utility/dtos/inventory/production-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/inventory/production-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { adjustStock, getStockByVariant, getStockMapForWarehouse } from "../warehouse/stock-level-service";
import { consumeBatch, addStockBatch, releaseBatch } from "./stock-batch-service";
import { consume as consumeQuarantineLot, get as getQuarantineLot, restore as restoreQuarantineLot } from "./quarantine-lot-service";
import { updateCostWeightedAverage, reverseCostWeightedAverage } from "./variant-service";
import { toDateOnly } from "../../utility/helper/date-only";
import { createJournalEntry } from "../finance/journal-service";
import { ensureInventory, ensureAccountsPayable } from "../../utility/helper/finance-accounts";

const POPULATE: [string, string][] = [
  ["outputVariantId", "variantName sku"],
  ["warehouseId", "name"],
  ["outputWarehouseId", "name"],
  ["rawLines.variantId", "variantName sku costPrice"],
  ["consumedBatches.variantId", "variantName sku"],
  ["quarantineLotId", "lotNumber remainingQty"],
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
  costPrice?: number;
}

interface CreateProductionInput {
  scheduledDate?: string;
  outputVariantId: string;
  outputQuantity: number;
  actualOutputQuantity?: number;
  warehouseId: string;
  outputWarehouseId?: string;
  outputExpiryDate?: string;
  outputBatchNo?: string;
  notes?: string;
  rawLines?: RawLineInput[];
  otherCostLines?: { label: string; amount: number }[];
  quarantineLotId?: string;
  quarantineQty?: number;
}

interface FefoTake {
  variantId: string;
  batchId: string;
  qty: number;
  unitCost: number;
  expiryDate: Date | null;
}

export interface ProductionShortage {
  variantId: string;
  available: number;
  requested: number;
}

interface ProductionResult {
  errorCode:
    | "success"
    | "not_found"
    | "invalid_status"
    | "variant_not_found"
    | "warehouse_not_found"
    | "insufficient_stock"
    | "lot_not_found"
    | "insufficient_quarantine"
    | "warehouse_mismatch"
    | "output_consumed";
  result: productionOrderDto | null;
  shortages?: ProductionShortage[];
}

// FEFO-consumes qty out of whatever batches this variant/warehouse actually
// has — same helper duplicated in Stock Transfer/Issue's own services for
// the identical reasoning (keeps StockBatch.remainingQty in sync with the
// aggregate StockLevel a sibling adjustStock call just changed).
const consumeFefo = async (variantId: string, warehouseId: string, qty: number): Promise<FefoTake[]> => {
  const batches = await StockBatchModel.find({ variantId, warehouseId, remainingQty: { $gt: 0 } }).sort({ expiryDate: 1 }).lean();
  const taken: FefoTake[] = [];
  let remaining = qty;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(Number(batch.remainingQty) || 0, remaining);
    if (take <= 0) continue;
    await consumeBatch(String(batch._id), take);
    taken.push({
      variantId,
      batchId: String(batch._id),
      qty: take,
      unitCost: Number(batch.unitCost) || 0,
      expiryDate: batch.expiryDate || null,
    });
    remaining -= take;
  }
  return taken;
};

const findWarehouse = async (warehouseId: string, scope: TenantScope) =>
  WarehouseModel.findOne({ _id: warehouseId, adminId: scope.adminId, merchantId: scope.merchantId }).lean();

const snapshotRawLineCosts = async (rawLines: RawLineInput[]): Promise<RawLineInput[]> => {
  const ids = (rawLines || []).map((l) => l.variantId).filter(Boolean);
  if (!ids.length) return rawLines || [];
  const variants = await VariantModel.find({ _id: { $in: ids } }).select("costPrice").lean();
  const costById = new Map(variants.map((v) => [String(v._id), Number(v.costPrice) || 0]));
  return (rawLines || []).map((l) => ({
    ...l,
    costPrice: l.costPrice != null ? Number(l.costPrice) : costById.get(String(l.variantId)) || 0,
  }));
};

const findRawShortages = async (
  scope: TenantScope,
  warehouseId: string,
  rawLines: { variantId?: unknown; quantity?: number }[]
): Promise<ProductionShortage[]> => {
  const requestedByVariant = new Map<string, number>();
  for (const line of rawLines || []) {
    if (!line?.variantId) continue;
    const qty = Number(line.quantity) || 0;
    const variantId = String(line.variantId);
    requestedByVariant.set(variantId, (requestedByVariant.get(variantId) || 0) + qty);
  }
  if (!requestedByVariant.size) return [];

  const availableMap = await getStockMapForWarehouse(
    { adminId: scope.adminId, merchantId: scope.merchantId },
    warehouseId
  );
  const shortages: ProductionShortage[] = [];
  for (const [variantId, requested] of requestedByVariant) {
    const available = availableMap.get(variantId) || 0;
    if (requested > available) {
      shortages.push({ variantId, available, requested });
    }
  }
  return shortages;
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
  const warehouse = await findWarehouse(data.warehouseId, scope);
  if (!warehouse) {
    return { errorCode: "warehouse_not_found", result: null };
  }
  const outputWarehouseId = data.outputWarehouseId || data.warehouseId;
  if (outputWarehouseId !== data.warehouseId) {
    const outputWarehouse = await findWarehouse(outputWarehouseId, scope);
    if (!outputWarehouse) {
      return { errorCode: "warehouse_not_found", result: null };
    }
  }
  const rawLines = data.rawLines || [];
  const variantIds = [data.outputVariantId, ...rawLines.map((l) => l.variantId)];
  const variantCount = await VariantModel.countDocuments({
    _id: { $in: variantIds },
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  });
  if (variantCount !== new Set(variantIds).size) {
    return { errorCode: "variant_not_found", result: null };
  }

  const shortages = await findRawShortages(scope, data.warehouseId, rawLines);
  if (shortages.length) {
    return { errorCode: "insufficient_stock", result: null, shortages };
  }

  let quarantineLotId: string | null = null;
  let quarantineQty: number | null = null;
  if (data.quarantineLotId) {
    const lot = await getQuarantineLot(data.quarantineLotId, {
      adminId: scope.adminId,
      merchantId: scope.merchantId,
    });
    if (!lot) {
      return { errorCode: "lot_not_found", result: null };
    }
    if (lot.warehouseId !== data.warehouseId) {
      return { errorCode: "warehouse_mismatch", result: null };
    }
    const take = Number(data.quarantineQty || data.outputQuantity) || 0;
    if (take <= 0 || take > (lot.remainingQty || 0)) {
      return { errorCode: "insufficient_quarantine", result: null };
    }
    quarantineLotId = lot.id;
    quarantineQty = take;
  }

  const orderNumber = await generateOrderNumber(scope);
  const order = await ProductionOrderModel.create({
    orderNumber,
    status: "Draft",
    scheduledDate: data.scheduledDate ? toDateOnly(data.scheduledDate) : null,
    outputVariantId: data.outputVariantId,
    outputQuantity: data.outputQuantity,
    actualOutputQuantity: data.actualOutputQuantity ?? null,
    warehouseId: data.warehouseId,
    outputWarehouseId,
    outputExpiryDate: data.outputExpiryDate ? toDateOnly(data.outputExpiryDate) : null,
    outputBatchNo: data.outputBatchNo || null,
    notes: data.notes || null,
    rawLines: await snapshotRawLineCosts(rawLines),
    otherCostLines: data.otherCostLines || [],
    quarantineLotId,
    quarantineQty,
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
  if (data.actualOutputQuantity !== undefined) order.actualOutputQuantity = data.actualOutputQuantity ?? null;
  if (data.warehouseId !== undefined) {
    const warehouse = await findWarehouse(data.warehouseId, {
      adminId: order.adminId ? String(order.adminId) : null,
      merchantId: order.merchantId ? String(order.merchantId) : null,
    });
    if (!warehouse) {
      return { errorCode: "warehouse_not_found", result: null };
    }
    order.warehouseId = data.warehouseId as any;
  }
  if (data.outputWarehouseId !== undefined) {
    if (!data.outputWarehouseId) {
      order.outputWarehouseId = order.warehouseId;
    } else {
      const outputWarehouse = await findWarehouse(data.outputWarehouseId, {
        adminId: order.adminId ? String(order.adminId) : null,
        merchantId: order.merchantId ? String(order.merchantId) : null,
      });
      if (!outputWarehouse) {
        return { errorCode: "warehouse_not_found", result: null };
      }
      order.outputWarehouseId = data.outputWarehouseId as any;
    }
  }
  if (data.outputExpiryDate !== undefined) {
    order.outputExpiryDate = data.outputExpiryDate ? toDateOnly(data.outputExpiryDate) : null;
  }
  if (data.outputBatchNo !== undefined) order.outputBatchNo = data.outputBatchNo || null;
  if (data.notes !== undefined) order.notes = data.notes;

  const nextWarehouseId = data.warehouseId !== undefined ? data.warehouseId : String(order.warehouseId);
  const nextRawLines = data.rawLines !== undefined ? data.rawLines : (order.rawLines as any) || [];
  const shortages = await findRawShortages(
    {
      adminId: order.adminId ? String(order.adminId) : null,
      merchantId: order.merchantId ? String(order.merchantId) : null,
    },
    nextWarehouseId,
    nextRawLines
  );
  if (shortages.length) {
    return { errorCode: "insufficient_stock", result: null, shortages };
  }

  if (data.rawLines !== undefined) order.rawLines = (await snapshotRawLineCosts(data.rawLines)) as any;
  if (data.otherCostLines !== undefined) order.otherCostLines = data.otherCostLines as any;
  if (data.quarantineLotId !== undefined) {
    if (!data.quarantineLotId) {
      order.quarantineLotId = null;
      order.quarantineQty = null;
    } else {
      const lot = await getQuarantineLot(data.quarantineLotId, filter);
      if (!lot) {
        return { errorCode: "lot_not_found", result: null };
      }
      const nextWarehouse = data.warehouseId !== undefined ? data.warehouseId : String(order.warehouseId);
      if (lot.warehouseId !== nextWarehouse) {
        return { errorCode: "warehouse_mismatch", result: null };
      }
      const take = Number(data.quarantineQty ?? order.quarantineQty ?? order.outputQuantity) || 0;
      if (take <= 0 || take > (lot.remainingQty || 0)) {
        return { errorCode: "insufficient_quarantine", result: null };
      }
      order.quarantineLotId = data.quarantineLotId as any;
      order.quarantineQty = take;
    }
  } else if (data.quarantineQty !== undefined) {
    order.quarantineQty = data.quarantineQty;
  }

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
  if (order.status === "Completed" || order.status === "Cancelled" || order.status === "Reversed") {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: order.adminId ? String(order.adminId) : null,
    merchantId: order.merchantId ? String(order.merchantId) : null,
  };
  const rawWarehouseId = String(order.warehouseId);
  const outputWarehouseId = String(order.outputWarehouseId || order.warehouseId);

  // Checked up front, across all raw lines, before anything is consumed —
  // adjustStock's own subtract floors at 0 rather than failing, so without
  // this a shortage on any line would silently succeed: stock goes to 0,
  // the output still gets produced and costed as if the full quantity was
  // really consumed, and nothing tells the user it was short.
  const shortages = await findRawShortages(scope, rawWarehouseId, order.rawLines || []);
  if (shortages.length) {
    return { errorCode: "insufficient_stock", result: null, shortages };
  }

  if (order.quarantineLotId) {
    const take = Number(order.quarantineQty || order.outputQuantity) || 0;
    const consumed = await consumeQuarantineLot(String(order.quarantineLotId), take, String(order._id), {
      adminId: scope.adminId,
      merchantId: scope.merchantId,
    });
    if (consumed.errorCode === "not_found") {
      return { errorCode: "lot_not_found", result: null };
    }
    if (consumed.errorCode !== "success") {
      return { errorCode: "insufficient_quarantine", result: null };
    }
  }

  let totalRawCost = 0;
  const consumedBatches: FefoTake[] = [];

  for (const line of order.rawLines || []) {
    const variant = await VariantModel.findById(line.variantId).lean();
    const consumedQty = line.quantity;

    await adjustStock(
      scope,
      String(line.variantId),
      rawWarehouseId,
      "subtract",
      consumedQty,
      `Production ${order.orderNumber} — raw material consumed`,
      actor
    );
    const taken = await consumeFefo(String(line.variantId), rawWarehouseId, consumedQty);
    consumedBatches.push(...taken);
    const takenQty = taken.reduce((s, t) => s + t.qty, 0);
    const takenCost = taken.reduce((s, t) => s + t.qty * t.unitCost, 0);
    // Leftover (stock-level qty with no batch row) still costs at the
    // variant average so the output isn't under-costed.
    totalRawCost += takenCost + Math.max(0, consumedQty - takenQty) * (variant?.costPrice || 0);
  }

  const otherCostTotal = (order.otherCostLines || []).reduce((sum, l) => sum + (l.amount || 0), 0);
  const outputQty = Number(order.actualOutputQuantity ?? order.outputQuantity) || 0;
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
    outputWarehouseId,
    "add",
    outputQty,
    `Production ${order.orderNumber} — output produced`,
    actor
  );
  if (outputQty > 0) {
    const createdBatch = await addStockBatch(
      {
        variantId: String(order.outputVariantId),
        warehouseId: outputWarehouseId,
        qty: outputQty,
        unitCost: unitCostThisBatch,
        expiryDate: order.outputExpiryDate ? String(order.outputExpiryDate) : undefined,
        sourceType: "Production",
        sourceRef: order.orderNumber || undefined,
      },
      scope
    );
    order.outputBatchId = createdBatch.id as any;
  }

  order.consumedBatches = consumedBatches as any;

  // Raw→finished conversion stays inside Inventory (same asset account),
  // so only incremental labor/overhead needs a journal: it capitalizes
  // into Inventory and is owed until paid. Expensing it here would
  // double-count once the finished goods later hit COGS at sale.
  if (otherCostTotal > 0) {
    const inventoryAccount = await ensureInventory(scope, actor);
    const accountsPayable = await ensureAccountsPayable(scope, actor);
    await createJournalEntry({
      tenant: scope,
      createdBy: actor,
      date: toDateOnly(new Date()),
      memo: `Production ${order.orderNumber} — labor & overhead`,
      lines: [
        { accountId: String(inventoryAccount._id), debit: otherCostTotal, credit: 0 },
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

const qtyClose = (a: unknown, b: unknown) =>
  Math.round((Number(a) || 0) * 1000) === Math.round((Number(b) || 0) * 1000);

// Undoes a Completed order only when the finished batch is still fully
// on hand (remainingQty === produced qty). Sold/transferred/issued output
// is rejected — partial reverse is not supported.
const reverse = async (
  id: string,
  filter: Record<string, unknown>,
  actor: string
): Promise<ProductionResult> => {
  const order = await ProductionOrderModel.findOne({ _id: id, ...filter });
  if (!order) {
    return { errorCode: "not_found", result: null };
  }
  if (order.status !== "Completed") {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: order.adminId ? String(order.adminId) : null,
    merchantId: order.merchantId ? String(order.merchantId) : null,
  };
  const rawWarehouseId = String(order.warehouseId);
  const outputWarehouseId = String(order.outputWarehouseId || order.warehouseId);
  const producedQty = Number(order.actualOutputQuantity ?? order.outputQuantity) || 0;

  let outputBatch = order.outputBatchId ? await StockBatchModel.findById(order.outputBatchId) : null;
  if (!outputBatch && order.orderNumber) {
    outputBatch = await StockBatchModel.findOne({
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      variantId: order.outputVariantId,
      warehouseId: outputWarehouseId,
      sourceType: "Production",
      sourceRef: order.orderNumber,
    });
  }

  const remaining = Number(outputBatch?.remainingQty) || 0;
  if (producedQty > 0 && !qtyClose(remaining, producedQty)) {
    return { errorCode: "output_consumed", result: null };
  }

  if (producedQty > 0) {
    const stockMap = await getStockMapForWarehouse(
      { adminId: scope.adminId, merchantId: scope.merchantId },
      outputWarehouseId
    );
    const available = stockMap.get(String(order.outputVariantId)) || 0;
    if (available + 0.0001 < producedQty) {
      return { errorCode: "output_consumed", result: null };
    }

    const existingQty = await getStockByVariant(scope, String(order.outputVariantId));
    await reverseCostWeightedAverage(
      String(order.outputVariantId),
      existingQty,
      producedQty,
      Number(outputBatch?.unitCost) || 0
    );
    await adjustStock(
      scope,
      String(order.outputVariantId),
      outputWarehouseId,
      "subtract",
      producedQty,
      `Production ${order.orderNumber} — reverse output`,
      actor
    );
    if (outputBatch) {
      await consumeBatch(String(outputBatch._id), producedQty);
    }
  }

  for (const line of order.rawLines || []) {
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;
    await adjustStock(
      scope,
      String(line.variantId),
      rawWarehouseId,
      "add",
      qty,
      `Production ${order.orderNumber} — reverse raw material`,
      actor
    );
  }
  for (const taken of order.consumedBatches || []) {
    if (!taken.batchId) continue;
    await releaseBatch(String(taken.batchId), Number(taken.qty) || 0);
  }

  if (order.quarantineLotId && order.quarantineQty) {
    await restoreQuarantineLot(String(order.quarantineLotId), Number(order.quarantineQty) || 0, filter);
  }

  const otherCostTotal = (order.otherCostLines || []).reduce((sum, l) => sum + (l.amount || 0), 0);
  if (otherCostTotal > 0) {
    const inventoryAccount = await ensureInventory(scope, actor);
    const accountsPayable = await ensureAccountsPayable(scope, actor);
    await createJournalEntry({
      tenant: scope,
      createdBy: actor,
      date: toDateOnly(new Date()),
      memo: `Production ${order.orderNumber} — reverse labor & overhead`,
      lines: [
        { accountId: String(accountsPayable._id), debit: otherCostTotal, credit: 0 },
        { accountId: String(inventoryAccount._id), debit: 0, credit: otherCostTotal },
      ],
    });
  }

  order.status = "Reversed";
  await order.save();
  await populateAll(order);
  return { errorCode: "success", result: mapDbToDto(order) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<ProductionResult> => {
  const order = await ProductionOrderModel.findOne({ _id: id, ...filter }).lean();
  if (!order) {
    return { errorCode: "not_found", result: null };
  }
  if (order.status === "Completed" || order.status === "Reversed") {
    return { errorCode: "invalid_status", result: null };
  }
  await ProductionOrderModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(order) };
};

export { create, getAll, get, update, complete, reverse, deleteByID };
