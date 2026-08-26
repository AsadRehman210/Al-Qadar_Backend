import { VariantModel } from "../../model/inventory/variant-model";
import { ProductModel } from "../../model/inventory/product-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { variantDto } from "../../utility/dtos/inventory/variant-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/inventory/variant-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { getStockTotalsByVariantIds, getStockByVariant, getStockMapForWarehouse } from "../warehouse/stock-level-service";

const POPULATE_FIELD = "productId";
const POPULATE_SELECT = "productName productType";

export interface VariantListOptions {
  search?: string;
  productId?: string;
  productType?: string;
  // When set, restricts results to variants with physical stock in this one
  // warehouse (Sale Invoice's variant picker) and attaches that warehouse's
  // qty as `availableQty` on each row instead of the cross-warehouse total.
  warehouseId?: string;
}

interface CreateVariantInput {
  productId: string;
  variantName?: string;
  sku: string;
  attributes?: Record<string, string>;
  costPrice?: number;
  salePrice?: number;
  unit?: string;
}

interface VariantResult {
  errorCode: "success" | "not_found" | "duplicate_sku";
  result: variantDto | null;
}

const create = async (
  data: CreateVariantInput,
  scope: TenantScope,
  createdBy: string
): Promise<VariantResult> => {
  const existing = await VariantModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    sku: data.sku,
  }).select("_id").lean();
  if (existing) {
    return { errorCode: "duplicate_sku", result: null };
  }

  const variant = await VariantModel.create({
    productId: data.productId,
    variantName: data.variantName || "",
    sku: data.sku,
    attributes: data.attributes || {},
    costPrice: Number(data.costPrice) || 0,
    salePrice: Number(data.salePrice) || 0,
    unit: data.unit || "pcs",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await variant.populate(POPULATE_FIELD, POPULATE_SELECT);
  return { errorCode: "success", result: mapDbToDto(variant) };
};

// productType lives on Product, not Variant — resolve it to a set of
// productIds first so the raw-material vs finished-good picker filters can
// stay server-side instead of the frontend bulk-fetching everything and
// matching client-side.
const resolveProductTypeFilter = async (
  filter: Record<string, unknown>,
  productType: string | undefined
): Promise<Record<string, unknown>> => {
  if (!productType) return {};
  const products = await ProductModel.find({ ...filter, productType }).select("_id").lean();
  return { productId: { $in: products.map((p) => p._id) } };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: VariantListOptions = {}
): Promise<{ totalCount: number; result: variantDto[] }> => {
  const startIndex = (page - 1) * limit;

  // Resolved before the main query (not after) so pagination/totalCount are
  // correct against the warehouse-restricted set, not the full catalog.
  const warehouseStock = options.warehouseId
    ? await getStockMapForWarehouse(filter, options.warehouseId)
    : null;

  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["variantName", "sku"]),
    ...buildExactFilters(options as Record<string, unknown>, { productId: "productId" }),
    ...(await resolveProductTypeFilter(filter, options.productType)),
    ...(warehouseStock ? { _id: { $in: Array.from(warehouseStock.keys()) } } : {}),
  };

  const data = await VariantModel.find(query)
    .populate(POPULATE_FIELD, POPULATE_SELECT)
    .skip(startIndex)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();
  const count = await VariantModel.countDocuments(query);

  // One bulk stock query for this page instead of the frontend cross-joining
  // a separate unpaginated Stock fetch — keeps table rows/pickers accurate
  // regardless of how many variants exist.
  const stockByVariantId = await getStockTotalsByVariantIds(
    filter,
    data.map((v) => String(v._id))
  );

  return { totalCount: count, result: mapDbListToDtoList(data, stockByVariantId, warehouseStock || undefined) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<variantDto | null> => {
  const data = await VariantModel.findOne({ _id: id, ...filter }).populate(POPULATE_FIELD, POPULATE_SELECT).lean();
  if (!data) return null;
  const scope: TenantScope = {
    adminId: data.adminId ? String(data.adminId) : null,
    merchantId: data.merchantId ? String(data.merchantId) : null,
  };
  const totalStock = await getStockByVariant(scope, id);
  return mapDbToDto(data, totalStock);
};

// Every variant, unfiltered — used by Production/Purchases/Sales to build
// raw-material and finished-good pickers without pagination getting in the
// way of "give me the whole catalog for this dropdown's initial fetch".
// Callers still paginate through the normal getAll for the interactive list.
const getByIds = async (ids: string[], filter: Record<string, unknown>): Promise<variantDto[]> => {
  const data = await VariantModel.find({ _id: { $in: ids }, ...filter }).populate(POPULATE_FIELD, POPULATE_SELECT).lean();
  return mapDbListToDtoList(data);
};

const update = async (
  id: string,
  data: Partial<CreateVariantInput>,
  filter: Record<string, unknown>
): Promise<VariantResult> => {
  if (data.sku) {
    const existing = await VariantModel.findOne({ ...filter, sku: data.sku, _id: { $ne: id } }).select("_id").lean();
    if (existing) {
      return { errorCode: "duplicate_sku", result: null };
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (data.productId !== undefined) updatePayload.productId = data.productId;
  if (data.variantName !== undefined) updatePayload.variantName = data.variantName;
  if (data.sku !== undefined) updatePayload.sku = data.sku;
  if (data.attributes !== undefined) updatePayload.attributes = data.attributes;
  if (data.costPrice !== undefined) updatePayload.costPrice = Number(data.costPrice) || 0;
  if (data.salePrice !== undefined) updatePayload.salePrice = Number(data.salePrice) || 0;
  if (data.unit !== undefined) updatePayload.unit = data.unit || "pcs";

  const updated = await VariantModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: updatePayload },
    { new: true }
  ).populate(POPULATE_FIELD, POPULATE_SELECT).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

// Weighted-average cost roll-up after a new batch adds stock at a new unit
// cost — called by Production (complete) and Purchases (receive). Mirrors
// the frontend's updateVariantCostWeightedAverage exactly.
const updateCostWeightedAverage = async (
  variantId: string,
  existingQty: number,
  newQty: number,
  newBatchUnitCost: number
): Promise<number> => {
  const variant = await VariantModel.findById(variantId);
  if (!variant) return 0;

  const oldQty = Math.max(0, Number(existingQty) || 0);
  const addedQty = Math.max(0, Number(newQty) || 0);
  const oldCost = Number(variant.costPrice) || 0;
  const totalQty = oldQty + addedQty;
  const weightedCost = totalQty > 0 ? (oldQty * oldCost + addedQty * newBatchUnitCost) / totalQty : newBatchUnitCost;
  const rounded = Math.round(weightedCost * 100) / 100;

  variant.costPrice = rounded;
  await variant.save();
  return rounded;
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<VariantResult> => {
  const deleted = await VariantModel.findOne({ _id: id, ...filter }).lean();
  if (!deleted) {
    return { errorCode: "not_found", result: null };
  }
  await VariantModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(deleted) };
};

export { create, getAll, get, getByIds, update, updateCostWeightedAverage, deleteByID };
