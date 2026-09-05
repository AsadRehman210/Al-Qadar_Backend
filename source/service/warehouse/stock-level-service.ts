import mongoose from "mongoose";
import { StockLevelModel } from "../../model/warehouse/stock-level-model";
import { StockAdjustmentModel, StockAdjustmentType } from "../../model/warehouse/stock-adjustment-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { toAggregateFilter } from "../../utility/helper/tenant-scope";
import { buildSearchCondition } from "../../utility/helper/list-query";

export interface StockRow {
  variantId: string;
  variantName: string | null;
  sku: string | null;
  productId: string | null;
  productName: string | null;
  productType: string | null;
  totalQty: number;
  minQty: number;
  status?: "in_stock" | "low_stock" | "out_of_stock";
  batchCount: number;
  byWarehouse: { warehouseId: string; warehouseName: string | null; qty: number; minQty: number }[];
}

/**
 * The one function that ever mutates StockLevel. Every stock-moving action
 * in the system — Production complete, Sale delivery, Purchase receive,
 * Credit/Debit Note reversal, Stock Transfer approve, Stock Issue create —
 * funnels through here. Also writes one StockAdjustment audit row per call,
 * so "why does this warehouse hold this much" is always traceable via `reason`.
 */
const toOid = (id: string | null | undefined): mongoose.Types.ObjectId | null => {
  if (!id) return null;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const oid = new mongoose.Types.ObjectId(id);
  return String(oid) === String(id) ? oid : null;
};

const adjustStock = async (
  scope: TenantScope,
  variantId: string,
  warehouseId: string,
  type: StockAdjustmentType,
  qty: number,
  reason: string,
  actor: string | null
): Promise<number> => {
  const amount = Math.max(0, Number(qty) || 0);
  const adminId = toOid(scope.adminId);
  const merchantId = toOid(scope.merchantId);
  const warehouseOid = toOid(warehouseId);
  const variantOid = toOid(variantId);
  if (!warehouseOid || !variantOid) {
    throw new Error("adjustStock requires a valid warehouseId and variantId");
  }

  // Query with ObjectIds — string vs ObjectId mismatch was creating a
  // second StockLevel (qty 0) while the list view kept reading the original.
  let level = await StockLevelModel.findOne({
    adminId,
    merchantId,
    warehouseId: warehouseOid,
    variantId: variantOid,
  });

  const before = level?.qty || 0;
  let after: number;
  if (type === "add") after = before + amount;
  else if (type === "subtract") after = Math.max(0, before - amount);
  else after = amount; // "set"

  if (level) {
    level.qty = after;
    await level.save();
  } else {
    level = await StockLevelModel.create({
      warehouseId: warehouseOid,
      variantId: variantOid,
      qty: after,
      minQty: 0,
      adminId,
      merchantId,
    });
  }

  await StockAdjustmentModel.create({
    warehouseId: warehouseOid,
    variantId: variantOid,
    type,
    qty: amount,
    reason,
    balanceBefore: before,
    balanceAfter: after,
    adjustedBy: actor,
    adminId,
    merchantId,
  });

  return after;
};

const setMinStock = async (
  scope: TenantScope,
  variantId: string,
  warehouseId: string,
  minQty: number
): Promise<void> => {
  await StockLevelModel.findOneAndUpdate(
    { adminId: scope.adminId, merchantId: scope.merchantId, warehouseId, variantId },
    { $set: { minQty: Number(minQty) || 0 }, $setOnInsert: { qty: 0 } },
    { upsert: true }
  );
};

// Total physical quantity for a variant, summed across every warehouse.
const getStockByVariant = async (scope: TenantScope, variantId: string): Promise<number> => {
  const rows = await StockLevelModel.find({ adminId: scope.adminId, merchantId: scope.merchantId, variantId }).lean();
  return rows.reduce((sum, r) => sum + (r.qty || 0), 0);
};

// Bulk version of getStockByVariant — one query for a whole page of variants
// instead of N+1, used by Variant's list endpoint so the frontend never has
// to bulk-fetch stock separately and join client-side.
const getStockTotalsByVariantIds = async (
  filter: Record<string, unknown>,
  variantIds: string[]
): Promise<Map<string, number>> => {
  if (!variantIds.length) return new Map();
  const rows = await StockLevelModel.find({ ...filter, variantId: { $in: variantIds } }).lean();
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.variantId);
    totals.set(key, (totals.get(key) || 0) + (row.qty || 0));
  }
  return totals;
};

// Every variant with physical stock in one specific warehouse, tenant-scoped
// — a single query that does double duty: the returned key set is exactly
// "which variants are sellable from this warehouse" (Sale Invoice's variant
// picker), and the values are each variant's available qty there (both the
// picker's display and the create/update stock-sufficiency check use this
// same map, so the two can never disagree).
const getStockMapForWarehouse = async (
  filter: Record<string, unknown>,
  warehouseId: string
): Promise<Map<string, number>> => {
  const rows = await StockLevelModel.find({ ...filter, warehouseId, qty: { $gt: 0 } }).lean();
  const map = new Map<string, number>();
  for (const row of rows) map.set(String(row.variantId), row.qty || 0);
  return map;
};

// True if this warehouse still holds any physical stock — used to block deletion.
const hasWarehouseStock = async (scope: TenantScope, warehouseId: string): Promise<boolean> => {
  const found = await StockLevelModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    warehouseId,
    qty: { $gt: 0 },
  }).lean();
  return !!found;
};

// The warehouse currently holding the most of this variant — used as the
// default target for manual adjustments when no warehouse is specified.
const getPrimaryWarehouseForVariant = async (scope: TenantScope, variantId: string): Promise<string | null> => {
  const rows = await StockLevelModel.find({ adminId: scope.adminId, merchantId: scope.merchantId, variantId })
    .sort({ qty: -1 })
    .lean();
  return rows[0] ? String(rows[0].warehouseId) : null;
};

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface StockViewOptions {
  search?: string;
  warehouseId?: string;
  variantId?: string;
  status?: StockStatus | string;
  page?: number;
  limit?: number;
}

const computeStockStatus = (totalQty: number, lowStockQty: number): StockStatus => {
  if (totalQty <= 0) return "out_of_stock";
  if (lowStockQty > 0 && totalQty < lowStockQty) return "low_stock";
  return "in_stock";
};

// Variant x total qty x per-warehouse breakdown — the Inventory "Stock" read
// view (§10.2), aggregated from StockLevel (Warehouse's data), joined with
// Variant/Product for display fields. Takes the same scope `filter` object
// buildScopeFilter() already produces for every other list endpoint (can be
// `{}` for a Super Admin viewing everything) — not a strict TenantScope,
// since "both fields null" must mean "no scope restriction", not "match
// nothing".
//
// Status (in_stock/low_stock/out_of_stock) is derived from totalQty summed
// across warehouses, which only exists after joining StockLevel — so unlike
// every other list endpoint, pagination has to happen *after* that join and
// the status filter are applied, not as a Mongo skip/limit on Variant alone.
const getStockView = async (
  filter: Record<string, unknown>,
  options: StockViewOptions = {}
): Promise<{ totalCount: number; result: StockRow[] }> => {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const startIndex = (page - 1) * limit;
  const matchScope = toAggregateFilter(filter);

  const variantMatch: Record<string, unknown> = { ...matchScope };
  if (options.search && options.search.trim()) {
    Object.assign(variantMatch, buildSearchCondition(options.search, ["variantName", "sku"]));
  }
  if (options.variantId) {
    variantMatch._id = options.variantId;
  }

  const variants = await VariantModel.find(variantMatch).populate("productId", "productName productType").lean();
  if (!variants.length) {
    return { totalCount: 0, result: [] };
  }
  const variantIds = variants.map((v) => v._id);

  const levelMatch: Record<string, unknown> = {
    ...matchScope,
    variantId: { $in: variantIds },
  };
  if (options.warehouseId) {
    levelMatch.warehouseId = new mongoose.Types.ObjectId(options.warehouseId);
  }
  const levels = await StockLevelModel.find(levelMatch).populate("warehouseId", "name").lean();

  const batchCounts = await StockBatchModel.aggregate([
    {
      $match: {
        ...matchScope,
        variantId: { $in: variantIds },
        ...(options.warehouseId ? { warehouseId: new mongoose.Types.ObjectId(options.warehouseId) } : {}),
      },
    },
    { $group: { _id: "$variantId", count: { $sum: 1 } } },
  ]);
  const batchCountByVariant = new Map(batchCounts.map((b) => [String(b._id), b.count as number]));

  let rows: StockRow[] = variants.map((v) => {
    const variantLevels = levels.filter((l) => String(l.variantId) === String(v._id));
    const product = v.productId as any;
    const totalQty = variantLevels.reduce((sum, l) => sum + (l.qty || 0), 0);
    const minQty = Math.max(0, Number((v as { lowStockQty?: number }).lowStockQty) || 0);
    return {
      variantId: String(v._id),
      variantName: v.variantName || null,
      sku: v.sku || null,
      productId: product?._id ? String(product._id) : null,
      productName: product?.productName || null,
      productType: product?.productType || null,
      totalQty,
      minQty,
      status: computeStockStatus(totalQty, minQty),
      batchCount: batchCountByVariant.get(String(v._id)) || 0,
      byWarehouse: variantLevels.map((l) => {
        const wh = l.warehouseId as any;
        const isPopulated = wh && typeof wh === "object" && "name" in wh;
        return {
          warehouseId: isPopulated ? String(wh._id) : String(wh),
          warehouseName: isPopulated ? wh.name || null : null,
          qty: l.qty || 0,
          minQty,
        };
      }),
    };
  });

  if (options.status) {
    const statuses = String(options.status).split(",").map((s) => s.trim());
    rows = rows.filter((r) => r.status && statuses.includes(r.status));
  }

  const totalCount = rows.length;
  return { totalCount, result: rows.slice(startIndex, startIndex + limit) };
};

// Aggregate stat cards (total SKUs, total units, low/out-of-stock counts) —
// computed server-side so the frontend never has to bulk-fetch every row
// just to total them up.
const getStockSummary = async (
  filter: Record<string, unknown>
): Promise<{ totalSkus: number; totalUnits: number; lowStockCount: number; outOfStockCount: number }> => {
  const matchScope = toAggregateFilter(filter);
  const variants = await VariantModel.find(matchScope).select("_id lowStockQty").lean();
  if (!variants.length) {
    return { totalSkus: 0, totalUnits: 0, lowStockCount: 0, outOfStockCount: 0 };
  }

  const levels = await StockLevelModel.find({ ...matchScope, variantId: { $in: variants.map((v) => v._id) } }).lean();
  const qtyByVariant = new Map<string, number>();
  for (const l of levels) {
    const key = String(l.variantId);
    qtyByVariant.set(key, (qtyByVariant.get(key) || 0) + (l.qty || 0));
  }

  let totalUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const v of variants) {
    const qty = qtyByVariant.get(String(v._id)) || 0;
    const minQty = Math.max(0, Number(v.lowStockQty) || 0);
    totalUnits += qty;
    const status = computeStockStatus(qty, minQty);
    if (status === "low_stock") lowStockCount++;
    if (status === "out_of_stock") outOfStockCount++;
  }

  return { totalSkus: variants.length, totalUnits, lowStockCount, outOfStockCount };
};

export interface AdjustmentHistoryOptions {
  variantId?: string;
  warehouseId?: string;
}

const getAdjustmentHistory = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: AdjustmentHistoryOptions = {}
) => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...(options.variantId ? { variantId: options.variantId } : {}),
    ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
  };

  const data = await StockAdjustmentModel.find(query)
    .populate("warehouseId", "name")
    .populate("variantId", "variantName sku")
    .skip(startIndex)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();
  const count = await StockAdjustmentModel.countDocuments(query);

  return {
    totalCount: count,
    result: data.map((a) => ({
      id: String(a._id),
      warehouseId: a.warehouseId ? String((a.warehouseId as any)._id || a.warehouseId) : null,
      warehouseName: (a.warehouseId as any)?.name || null,
      variantId: a.variantId ? String((a.variantId as any)._id || a.variantId) : null,
      variantName: (a.variantId as any)?.variantName || null,
      sku: (a.variantId as any)?.sku || null,
      type: a.type,
      qty: a.qty,
      reason: a.reason,
      balanceBefore: a.balanceBefore,
      balanceAfter: a.balanceAfter,
      createdAt: a.createdAt,
    })),
  };
};

export {
  adjustStock,
  setMinStock,
  getStockByVariant,
  getStockTotalsByVariantIds,
  getStockMapForWarehouse,
  hasWarehouseStock,
  getPrimaryWarehouseForVariant,
  getStockView,
  getStockSummary,
  getAdjustmentHistory,
};
