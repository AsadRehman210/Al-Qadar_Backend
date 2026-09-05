export interface variantDto {
  id: string;
  productId?: string | null;
  productName?: string | null;
  productType?: string | null;
  variantName?: string | null;
  sku?: string | null;
  attributes?: Record<string, string> | null;
  costPrice?: number | null;
  salePrice?: number | null;
  unit?: string | null;
  lowStockQty?: number | null;
  totalStock?: number | null;
  // Only populated when the request filtered by a specific warehouseId
  // (e.g. Sale Invoice's variant picker) — this warehouse's own qty, not
  // the cross-warehouse total in `totalStock`.
  availableQty?: number | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
