import { StockBatchModel } from "../../model/inventory/stock-batch-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { stockBatchDto } from "../../utility/dtos/inventory/stock-batch-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/inventory/stock-batch-mapper";
import { buildExactFilters } from "../../utility/helper/list-query";
import { toDateOnly } from "../../utility/helper/date-only";

const POPULATE: [string, string][] = [
  ["variantId", "variantName sku"],
  ["warehouseId", "name"],
];

interface AddStockBatchInput {
  variantId: string;
  warehouseId: string;
  batchNo?: string;
  qty: number;
  unitCost?: number;
  expiryDate?: string;
  receivedDate?: string;
  sourceType?: string;
  sourceRef?: string;
}

// Called alongside adjustStock() by Purchase receipt / Production complete —
// never exposed as a standalone write endpoint on its own, since a batch
// only ever exists as a side effect of an actual stock-adding event.
const addStockBatch = async (data: AddStockBatchInput, scope: TenantScope): Promise<stockBatchDto> => {
  const batch = await StockBatchModel.create({
    variantId: data.variantId,
    warehouseId: data.warehouseId,
    batchNo: data.batchNo || null,
    qty: data.qty,
    remainingQty: data.qty,
    unitCost: data.unitCost || 0,
    expiryDate: data.expiryDate ? toDateOnly(data.expiryDate) : null,
    receivedDate: toDateOnly(data.receivedDate ? new Date(data.receivedDate) : new Date()),
    sourceType: data.sourceType || null,
    sourceRef: data.sourceRef || null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
  });
  for (const [field, select] of POPULATE) await batch.populate(field, select);
  return mapDbToDto(batch);
};

// Called alongside adjustStock() when a Sale Invoice line that picked a
// specific batch gets Delivered — mirrors adjustStock's warehouse-level
// decrement, but at the batch level, so FEFO availability stays accurate
// for the next sale. Floored at 0 rather than going negative if something
// oversold past what findBatchShortages caught.
const consumeBatch = async (batchId: string, qty: number): Promise<void> => {
  const batch = await StockBatchModel.findById(batchId);
  if (!batch) return;
  batch.remainingQty = Math.max(0, (Number(batch.remainingQty) || 0) - (Number(qty) || 0));
  await batch.save();
};

// The reverse of consumeBatch — a Sale Invoice line that had reserved
// against this batch is being cancelled or edited away, so its qty goes
// back. Capped at the batch's original qty so a double-release can never
// inflate a batch past what it actually ever held.
const releaseBatch = async (batchId: string, qty: number): Promise<void> => {
  const batch = await StockBatchModel.findById(batchId);
  if (!batch) return;
  const cap = Number(batch.qty) || 0;
  batch.remainingQty = Math.min(cap, (Number(batch.remainingQty) || 0) + (Number(qty) || 0));
  await batch.save();
};

// Purchase Invoice's update() lets a line's expiryDate keep changing even
// after Received (see that function's own comment on why), but the batch
// row it already wrote at Received-time never re-read that edit on its
// own — this is what keeps the two in sync. Matched by (variant, warehouse,
// sourceType, sourceRef) rather than a batch id, since the invoice itself
// never stored which batch document it created.
const updateBatchExpiryBySource = async (
  scope: TenantScope,
  variantId: string,
  warehouseId: string,
  sourceType: string,
  sourceRef: string,
  expiryDate: string | null | undefined
): Promise<void> => {
  await StockBatchModel.updateMany(
    {
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      variantId,
      warehouseId,
      sourceType,
      sourceRef,
    },
    { $set: { expiryDate: expiryDate ? toDateOnly(expiryDate) : null } }
  );
};

export interface StockBatchListOptions {
  variantId?: string;
  warehouseId?: string;
  onlyAvailable?: boolean;
  sortId?: string;
}

// Batch history's own sort control (Stock/Variant detail pages) — ignored
// for the FEFO picker, which always sorts earliest-expiry-first regardless.
const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  expiry_asc: { expiryDate: 1 },
  expiry_desc: { expiryDate: -1 },
  cost_asc: { unitCost: 1 },
  cost_desc: { unitCost: -1 },
  stock_asc: { remainingQty: 1 },
  stock_desc: { remainingQty: -1 },
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: StockBatchListOptions = {}
): Promise<{ totalCount: number; result: stockBatchDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildExactFilters(options as Record<string, unknown>, { variantId: "variantId", warehouseId: "warehouseId" }),
    // FEFO picker (Sale Invoice's per-line batch dropdown) only ever wants
    // batches that still have stock left — sorted earliest-expiry-first so
    // that's the default/top pick.
    ...(options.onlyAvailable ? { remainingQty: { $gt: 0 } } : {}),
  };

  // FEFO picker sorts earliest-expiry-first (that's the pick order) no
  // matter what; every other consumer defaults to latest-added-first, or
  // its own explicit sortId if one was requested.
  const sort: Record<string, 1 | -1> = options.onlyAvailable
    ? { expiryDate: 1 }
    : (options.sortId && SORT_MAP[options.sortId]) || { createdAt: -1 };
  let cursor = StockBatchModel.find(query).skip(startIndex).limit(limit).sort(sort);
  for (const [field, select] of POPULATE) cursor = cursor.populate(field, select) as any;
  const data = await cursor.lean();
  const count = await StockBatchModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

export { addStockBatch, consumeBatch, releaseBatch, updateBatchExpiryBySource, getAll };
