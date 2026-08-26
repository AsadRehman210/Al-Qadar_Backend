import { ProductModel } from "../../model/inventory/product-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { CategoryModel } from "../../model/inventory/category-model";
import { StockLevelModel } from "../../model/warehouse/stock-level-model";
import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { toAggregateFilter } from "../../utility/helper/tenant-scope";
import { getStockSummary } from "../warehouse/stock-level-service";
import { formatDateOnly } from "../../utility/helper/date-only";
import { getOrSet, buildCacheKey } from "../../utility/helper/cache";

// Dashboard/Reports hit these with the same tenant+params repeatedly —
// short TTL so it's a staleness/perf tradeoff, never a source-of-truth
// change (a stale KPI for at most this long, never wrong-tenant data).
const CACHE_TTL_SECONDS = 30;

export interface InventoryOverview {
  totalProducts: number;
  totalVariants: number;
  totalCategories: number;
  totalSkus: number;
  totalUnits: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  byCategory: { categoryId: string; categoryName: string; productCount: number }[];
  byProductType: { type: string; count: number }[];
}

const getOverview = async (filter: Record<string, unknown>): Promise<InventoryOverview> =>
  getOrSet(buildCacheKey("inventory-analytics:getOverview", filter), CACHE_TTL_SECONDS, () => getOverviewImpl(filter));

const getOverviewImpl = async (filter: Record<string, unknown>): Promise<InventoryOverview> => {
  const matchScope = toAggregateFilter(filter);

  const totalProducts = await ProductModel.countDocuments(filter as any);
  const totalVariants = await VariantModel.countDocuments(filter as any);
  const totalCategories = await CategoryModel.countDocuments(filter as any);

  const { totalSkus, totalUnits, lowStockCount, outOfStockCount } = await getStockSummary(filter);

  // Stock value at cost — join StockLevel qty with each variant's own
  // costPrice, same "value at cost" convention the Inventory Stock report
  // already uses on the frontend (now computed server-side instead).
  const variants = await VariantModel.find(filter as any, { costPrice: 1 }).lean();
  const costByVariant = new Map(variants.map((v) => [String(v._id), v.costPrice || 0]));
  const levels = await StockLevelModel.find({ ...(filter as any), variantId: { $in: variants.map((v) => v._id) } }, { variantId: 1, qty: 1 }).lean();
  let totalStockValue = 0;
  for (const l of levels) {
    totalStockValue += (l.qty || 0) * (costByVariant.get(String(l.variantId)) || 0);
  }
  totalStockValue = Math.round(totalStockValue * 100) / 100;

  const categoryGrouped = await ProductModel.aggregate([
    { $match: matchScope },
    { $group: { _id: "$categoryId", productCount: { $sum: 1 } } },
    { $sort: { productCount: -1 } },
  ]);
  const categoryIds = categoryGrouped.map((g) => g._id).filter(Boolean);
  const categories = await CategoryModel.find({ _id: { $in: categoryIds } }, { name: 1 }).lean();
  const categoryNameById = new Map(categories.map((c) => [String(c._id), c.name || "—"]));
  const byCategory = categoryGrouped
    .filter((g) => g._id)
    .map((g) => ({
      categoryId: String(g._id),
      categoryName: categoryNameById.get(String(g._id)) || "—",
      productCount: g.productCount,
    }));

  const productTypeGrouped = await ProductModel.aggregate([
    { $match: matchScope },
    { $group: { _id: "$productType", count: { $sum: 1 } } },
  ]);
  const byProductType = productTypeGrouped.map((g) => ({ type: g._id || "unspecified", count: g.count }));

  return {
    totalProducts,
    totalVariants,
    totalCategories,
    totalSkus,
    totalUnits,
    totalStockValue,
    lowStockCount,
    outOfStockCount,
    byCategory,
    byProductType,
  };
};

export interface ExpiryBatchRow {
  batchId: string;
  variantId: string;
  sku: string | null;
  variantName: string | null;
  productName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  expiryDate: string | null;
  remainingQty: number;
  daysLeft: number;
}

export interface ExpiryBucket {
  key: "expired" | "within_1_month" | "within_6_months" | "within_1_year";
  label: string;
  count: number;
  totalQty: number;
  rows: ExpiryBatchRow[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const EXPIRY_BUCKET_KEYS: ExpiryBucket["key"][] = ["expired", "within_1_month", "within_6_months", "within_1_year"];
const EXPIRY_BUCKET_LABELS: Record<ExpiryBucket["key"], string> = {
  expired: "Expired",
  within_1_month: "Expiring within 1 month",
  within_6_months: "Expiring within 6 months",
  within_1_year: "Expiring within 1 year",
};

// Shared bucketing pass — both getExpiryBuckets (lightweight summary: counts
// only, for KPI cards) and getExpiryBucketDetail (one bucket's rows,
// paginated) read off this single computation so the two can never drift
// out of sync with each other.
const computeExpiryBuckets = async (filter: Record<string, unknown>): Promise<Record<ExpiryBucket["key"], ExpiryBatchRow[]>> => {
  const now = new Date();
  const in1Month = new Date(now);
  in1Month.setUTCMonth(in1Month.getUTCMonth() + 1);
  const in6Months = new Date(now);
  in6Months.setUTCMonth(in6Months.getUTCMonth() + 6);
  const in1Year = new Date(now);
  in1Year.setUTCFullYear(in1Year.getUTCFullYear() + 1);

  const batches = await StockBatchModel.find({
    ...(filter as any),
    remainingQty: { $gt: 0 },
    expiryDate: { $ne: null, $lte: in1Year },
  })
    .populate("variantId", "sku variantName productId")
    .populate("warehouseId", "name")
    .sort({ expiryDate: 1 })
    .lean();

  // Variant doesn't carry its Product inline — batch through once to
  // resolve productName for every distinct variant referenced.
  const productIds = [
    ...new Set(
      batches
        .map((b) => (b.variantId as any)?.productId)
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];
  const products = productIds.length
    ? await ProductModel.find({ _id: { $in: productIds } }, { productName: 1 }).lean()
    : [];
  const productNameById = new Map(products.map((p) => [String(p._id), p.productName || "—"]));

  const buckets: Record<ExpiryBucket["key"], ExpiryBatchRow[]> = {
    expired: [],
    within_1_month: [],
    within_6_months: [],
    within_1_year: [],
  };

  for (const b of batches) {
    const variant = b.variantId as any;
    const warehouse = b.warehouseId as any;
    const expiryDate = b.expiryDate as Date;
    const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / MS_PER_DAY);
    const row: ExpiryBatchRow = {
      batchId: String(b._id),
      variantId: variant?._id ? String(variant._id) : String(b.variantId),
      sku: variant?.sku || null,
      variantName: variant?.variantName || null,
      productName: variant?.productId ? productNameById.get(String(variant.productId)) || "—" : "—",
      warehouseId: warehouse?._id ? String(warehouse._id) : String(b.warehouseId),
      warehouseName: warehouse?.name || null,
      expiryDate: formatDateOnly(expiryDate),
      remainingQty: b.remainingQty || 0,
      daysLeft,
    };

    if (expiryDate <= now) buckets.expired.push(row);
    else if (expiryDate <= in1Month) buckets.within_1_month.push(row);
    else if (expiryDate <= in6Months) buckets.within_6_months.push(row);
    else buckets.within_1_year.push(row);
  }

  return buckets;
};

// Lightweight summary — counts + totalQty per bucket only, no row data.
// What Dashboard's KPI cards and Reports' bucket-selector cards need.
const getExpiryBuckets = async (filter: Record<string, unknown>): Promise<{ asOf: string; buckets: ExpiryBucket[] }> =>
  getOrSet(buildCacheKey("inventory-analytics:getExpiryBuckets", filter), CACHE_TTL_SECONDS, () => getExpiryBucketsImpl(filter));

const getExpiryBucketsImpl = async (filter: Record<string, unknown>): Promise<{ asOf: string; buckets: ExpiryBucket[] }> => {
  const buckets = await computeExpiryBuckets(filter);
  const result: ExpiryBucket[] = EXPIRY_BUCKET_KEYS.map((key) => ({
    key,
    label: EXPIRY_BUCKET_LABELS[key],
    count: buckets[key].length,
    totalQty: buckets[key].reduce((s, r) => s + r.remainingQty, 0),
    rows: [],
  }));
  return { asOf: formatDateOnly(new Date()) as string, buckets: result };
};

// One bucket's rows, paginated — backs both the Dashboard drill-down modal
// and Reports' Expiry tab table.
const getExpiryBucketDetail = async (
  filter: Record<string, unknown>,
  bucket: ExpiryBucket["key"],
  page: number,
  limit: number
): Promise<{ totalCount: number; result: ExpiryBatchRow[] }> => {
  const buckets = await computeExpiryBuckets(filter);
  const rows = buckets[bucket] || [];
  const startIndex = (page - 1) * limit;
  return { totalCount: rows.length, result: rows.slice(startIndex, startIndex + limit) };
};

export { getOverview, getExpiryBuckets, getExpiryBucketDetail };
