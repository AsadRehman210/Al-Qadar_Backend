import { variantDto } from "../../dtos/inventory/variant-dto";
import { IVariantModel } from "../../../model/inventory/variant-model";

const populatedProduct = (value: unknown): { id: string | null; name: string | null; type: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null, type: null };
  if (!("productName" in doc)) return { id: String(value), name: null, type: null };
  return {
    id: doc._id ? String(doc._id) : null,
    name: (doc.productName as string) || null,
    type: (doc.productType as string) || null,
  };
};

const mapDbToDto = (
  dbModel: IVariantModel,
  totalStock: number | null = null,
  availableQty: number | null = null
): variantDto => {
  const product = populatedProduct(dbModel.productId);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    productId: product.id,
    productName: product.name,
    productType: product.type,
    variantName: dbModel.variantName || null,
    sku: dbModel.sku || null,
    attributes: dbModel.attributes || {},
    costPrice: dbModel.costPrice ?? 0,
    salePrice: dbModel.salePrice ?? 0,
    unit: dbModel.unit || "pcs",
    totalStock,
    availableQty,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

// stockByVariantId: optional Map<variantId, totalStock> — pass when the
// caller has already bulk-fetched stock levels for this page (see
// variant-service.getAll), otherwise totalStock is left null.
// availableQtyByVariantId: optional Map<variantId, qty> scoped to one
// warehouse (see variant-service.getAll's warehouseId filter).
const mapDbListToDtoList = (
  dbModels: IVariantModel[],
  stockByVariantId?: Map<string, number>,
  availableQtyByVariantId?: Map<string, number>
): variantDto[] => {
  return dbModels.map((m) =>
    mapDbToDto(
      m,
      stockByVariantId?.get(String(m._id)) ?? null,
      availableQtyByVariantId?.get(String(m._id)) ?? null
    )
  );
};

export { mapDbToDto, mapDbListToDtoList };
