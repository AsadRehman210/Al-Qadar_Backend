import { productDto } from "../../dtos/inventory/product-dto";
import { IProductModel } from "../../../model/inventory/product-model";

const populatedCategory = (value: unknown): { id: string | null; name: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { id: value ? String(value) : null, name: null };
  if (!("name" in doc)) return { id: String(value), name: null };
  return { id: doc._id ? String(doc._id) : null, name: (doc.name as string) || null };
};

interface StockInfo {
  totalStock: number;
  variantCount: number;
}

const mapDbToDto = (dbModel: IProductModel, stockInfo?: StockInfo): productDto => {
  const category = populatedCategory(dbModel.categoryId);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    productName: dbModel.productName || null,
    categoryId: category.id,
    categoryName: category.name,
    productType: dbModel.productType || null,
    status: dbModel.status || null,
    totalStock: stockInfo?.totalStock ?? null,
    variantCount: stockInfo?.variantCount ?? null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

// stockByProductId: optional Map<productId, StockInfo> — see product-service.getAll.
const mapDbListToDtoList = (
  dbModels: IProductModel[],
  stockByProductId?: Map<string, StockInfo>
): productDto[] => {
  return dbModels.map((m) => mapDbToDto(m, stockByProductId?.get(String(m._id))));
};

export { mapDbToDto, mapDbListToDtoList };
