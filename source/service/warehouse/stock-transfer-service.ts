import { StockTransferModel } from "../../model/warehouse/stock-transfer-model";
import { WarehouseModel } from "../../model/warehouse/warehouse-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { stockTransferDto } from "../../utility/dtos/warehouse/stock-transfer-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/warehouse/stock-transfer-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { adjustStock, getStockMapForWarehouse } from "./stock-level-service";
import { consumeBatch, addStockBatch } from "../inventory/stock-batch-service";
import { toDateOnly } from "../../utility/helper/date-only";

const POPULATE: [string, string][] = [
  ["fromWarehouseId", "name"],
  ["toWarehouseId", "name"],
  ["items.variantId", "variantName sku"],
];

const populateAll = async (doc: any) => {
  for (const [field, select] of POPULATE) await doc.populate(field, select);
  return doc;
};

export interface StockTransferListOptions {
  search?: string;
  status?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
}

interface TransferItemInput {
  variantId: string;
  qty: number;
}

interface CreateStockTransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  date: string;
  notes?: string;
  items: TransferItemInput[];
}

export interface TransferShortage {
  variantId: string;
  available: number;
  requested: number;
}

interface StockTransferResult {
  errorCode: "success" | "not_found" | "invalid_status" | "same_warehouse" | "warehouse_not_found" | "insufficient_stock";
  result: stockTransferDto | null;
  shortages?: TransferShortage[];
}

const generateTransferNo = async (tenant: TenantScope): Promise<string> => {
  const count = await StockTransferModel.countDocuments({ adminId: tenant.adminId, merchantId: tenant.merchantId });
  return `TRF-${String(count + 1).padStart(6, "0")}`;
};

// Creating a transfer has no stock effect yet — it only moves once approved.
const create = async (
  data: CreateStockTransferInput,
  scope: TenantScope,
  createdBy: string
): Promise<StockTransferResult> => {
  if (String(data.fromWarehouseId) === String(data.toWarehouseId)) {
    return { errorCode: "same_warehouse", result: null };
  }

  const [fromWarehouse, toWarehouse] = await Promise.all([
    WarehouseModel.findOne({ _id: data.fromWarehouseId, adminId: scope.adminId, merchantId: scope.merchantId }).lean(),
    WarehouseModel.findOne({ _id: data.toWarehouseId, adminId: scope.adminId, merchantId: scope.merchantId }).lean(),
  ]);
  if (!fromWarehouse || !toWarehouse) {
    return { errorCode: "warehouse_not_found", result: null };
  }

  const transferNo = await generateTransferNo(scope);
  const transfer = await StockTransferModel.create({
    transferNo,
    fromWarehouseId: data.fromWarehouseId,
    toWarehouseId: data.toWarehouseId,
    date: toDateOnly(data.date),
    status: "Pending",
    notes: data.notes || null,
    items: data.items,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await populateAll(transfer);
  return { errorCode: "success", result: mapDbToDto(transfer) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: StockTransferListOptions = {}
): Promise<{ totalCount: number; result: stockTransferDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["transferNo"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      fromWarehouseId: "fromWarehouseId",
      toWarehouseId: "toWarehouseId",
    }),
  };

  let cursor = StockTransferModel.find(query).skip(startIndex).limit(limit).sort({ createdAt: -1 });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await StockTransferModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<stockTransferDto | null> => {
  let cursor = StockTransferModel.findOne({ _id: id, ...filter });
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  return data ? mapDbToDto(data) : null;
};

// FEFO-consumes qty out of whatever batches this variant/warehouse actually
// has (earliest expiry first), so the batch total always agrees with the
// aggregate StockLevel this same approve() call is about to subtract from —
// the exact desync class of bug fixed on Credit/Debit Note this session.
// Returns what it could actually pull, for the caller to build the
// destination batch from (weighted-average cost, earliest expiry carried over).
const consumeFefo = async (
  variantId: string,
  warehouseId: string,
  qty: number
): Promise<{ consumedQty: number; avgUnitCost: number; earliestExpiry: Date | null }> => {
  const batches = await StockBatchModel.find({ variantId, warehouseId, remainingQty: { $gt: 0 } }).sort({ expiryDate: 1 }).lean();
  let remaining = qty;
  let totalCost = 0;
  let earliestExpiry: Date | null = null;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(Number(batch.remainingQty) || 0, remaining);
    if (take <= 0) continue;
    await consumeBatch(String(batch._id), take);
    totalCost += take * (Number(batch.unitCost) || 0);
    if (batch.expiryDate && (!earliestExpiry || batch.expiryDate < earliestExpiry)) earliestExpiry = batch.expiryDate;
    remaining -= take;
  }
  const consumedQty = qty - remaining;
  return { consumedQty, avgUnitCost: consumedQty > 0 ? totalCost / consumedQty : 0, earliestExpiry };
};

// Approve: subtract from source, add to destination — via the one adjustStock
// choke point, so both legs write their own audit trail. Guarded to only
// ever run once (Pending -> Completed). Stock sufficiency is checked against
// the source warehouse first — previously this fabricated stock system-wide
// (destination always got the full requested qty even when the source only
// had a fraction of it, since adjustStock's subtract silently floors at 0
// instead of failing).
const approve = async (
  id: string,
  filter: Record<string, unknown>,
  approvedBy: string
): Promise<StockTransferResult> => {
  const transfer = await StockTransferModel.findOne({ _id: id, ...filter });
  if (!transfer) {
    return { errorCode: "not_found", result: null };
  }
  if (transfer.status !== "Pending") {
    return { errorCode: "invalid_status", result: null };
  }

  const scope: TenantScope = {
    adminId: transfer.adminId ? String(transfer.adminId) : null,
    merchantId: transfer.merchantId ? String(transfer.merchantId) : null,
  };

  const availableMap = await getStockMapForWarehouse(
    { adminId: scope.adminId, merchantId: scope.merchantId },
    String(transfer.fromWarehouseId)
  );
  const shortages: TransferShortage[] = [];
  for (const item of transfer.items || []) {
    const available = availableMap.get(String(item.variantId)) || 0;
    if (item.qty > available) {
      shortages.push({ variantId: String(item.variantId), available, requested: item.qty });
    }
  }
  if (shortages.length) {
    return { errorCode: "insufficient_stock", result: null, shortages };
  }

  for (const item of transfer.items || []) {
    await adjustStock(
      scope,
      String(item.variantId),
      String(transfer.fromWarehouseId),
      "subtract",
      item.qty,
      `Stock Transfer ${transfer.transferNo} — out`,
      approvedBy
    );
    await adjustStock(
      scope,
      String(item.variantId),
      String(transfer.toWarehouseId),
      "add",
      item.qty,
      `Stock Transfer ${transfer.transferNo} — in`,
      approvedBy
    );

    const { consumedQty, avgUnitCost, earliestExpiry } = await consumeFefo(
      String(item.variantId),
      String(transfer.fromWarehouseId),
      item.qty
    );
    // A new batch at the destination for whatever was actually traceable to
    // a source batch — carries the blended cost/earliest expiry forward
    // instead of losing FEFO tracking for transferred stock entirely.
    if (consumedQty > 0) {
      await addStockBatch(
        {
          variantId: String(item.variantId),
          warehouseId: String(transfer.toWarehouseId),
          qty: consumedQty,
          unitCost: avgUnitCost,
          expiryDate: earliestExpiry ? earliestExpiry.toISOString() : undefined,
          sourceType: "Stock Transfer",
          sourceRef: transfer.transferNo || undefined,
        },
        scope
      );
    }
  }

  transfer.status = "Completed";
  transfer.approvedBy = approvedBy as any;
  await transfer.save();
  await populateAll(transfer);

  return { errorCode: "success", result: mapDbToDto(transfer) };
};

export { create, getAll, get, approve };
