import { ProductModel, ProductType } from "../../model/inventory/product-model";
import { VariantModel } from "../../model/inventory/variant-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { productDto } from "../../utility/dtos/inventory/product-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/inventory/product-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { getStockTotalsByVariantIds } from "../warehouse/stock-level-service";

const POPULATE_FIELD = "categoryId";
const POPULATE_SELECT = "name";

export interface ProductListOptions {
  search?: string;
  categoryId?: string;
  productType?: string;
  status?: string;
}

interface CreateProductInput {
  productName: string;
  categoryId: string;
  productType?: ProductType;
  status?: string;
}

interface ProductResult {
  errorCode: "success" | "not_found";
  result: productDto | null;
}

const create = async (
  data: CreateProductInput,
  scope: TenantScope,
  createdBy: string
): Promise<ProductResult> => {
  const product = await ProductModel.create({
    productName: data.productName,
    categoryId: data.categoryId,
    productType: data.productType || "Finished Product",
    status: data.status || "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await product.populate(POPULATE_FIELD, POPULATE_SELECT);
  return { errorCode: "success", result: mapDbToDto(product) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: ProductListOptions = {}
): Promise<{ totalCount: number; result: productDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["productName"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      categoryId: "categoryId",
      productType: "productType",
      status: "status",
    }),
  };

  const data = await ProductModel.find(query)
    .populate(POPULATE_FIELD, POPULATE_SELECT)
    .skip(startIndex)
    .limit(limit)
    .sort({ productName: 1 })
    .lean();
  const count = await ProductModel.countDocuments(query);

  // Roll up "total stock across all this product's variants" server-side —
  // one bulk query for this page instead of the frontend cross-joining a
  // separate unpaginated Stock fetch per product.
  const productIds = data.map((p) => String(p._id));
  const variants = await VariantModel.find({ productId: { $in: productIds } }).select("_id productId").lean();
  const stockByVariantId = await getStockTotalsByVariantIds(
    filter,
    variants.map((v) => String(v._id))
  );
  const stockByProductId = new Map<string, { totalStock: number; variantCount: number }>();
  for (const v of variants) {
    const key = String(v.productId);
    const entry = stockByProductId.get(key) || { totalStock: 0, variantCount: 0 };
    entry.totalStock += stockByVariantId.get(String(v._id)) || 0;
    entry.variantCount += 1;
    stockByProductId.set(key, entry);
  }

  return { totalCount: count, result: mapDbListToDtoList(data, stockByProductId) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<productDto | null> => {
  const data = await ProductModel.findOne({ _id: id, ...filter }).populate(POPULATE_FIELD, POPULATE_SELECT).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateProductInput>,
  filter: Record<string, unknown>
): Promise<ProductResult> => {
  const updatePayload: Record<string, unknown> = {};
  if (data.productName !== undefined) updatePayload.productName = data.productName;
  if (data.categoryId !== undefined) updatePayload.categoryId = data.categoryId;
  if (data.productType !== undefined) updatePayload.productType = data.productType;
  if (data.status !== undefined) updatePayload.status = data.status;

  const updated = await ProductModel.findOneAndUpdate(
    { _id: id, ...filter },
    { $set: updatePayload },
    { new: true }
  ).populate(POPULATE_FIELD, POPULATE_SELECT).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<ProductResult> => {
  const deleted = await ProductModel.findOne({ _id: id, ...filter }).lean();
  if (!deleted) {
    return { errorCode: "not_found", result: null };
  }
  await ProductModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(deleted) };
};

// Bulk import — mirrors the frontend's createProductsBulk.
const createBulk = async (
  rows: CreateProductInput[],
  scope: TenantScope,
  createdBy: string
): Promise<productDto[]> => {
  const docs = await ProductModel.insertMany(
    rows.map((row) => ({
      productName: row.productName,
      categoryId: row.categoryId,
      productType: row.productType || "Finished Product",
      status: row.status || "Active",
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      createdBy,
    }))
  );
  return mapDbListToDtoList(docs as any);
};

export { create, getAll, get, update, deleteByID, createBulk };
