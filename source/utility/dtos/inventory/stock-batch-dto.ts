export interface stockBatchDto {
  id: string;
  variantId?: string | null;
  variantName?: string | null;
  sku?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  batchNo?: string | null;
  qty?: number | null;
  remainingQty?: number | null;
  unitCost?: number | null;
  expiryDate?: string | null;
  receivedDate?: string | null;
  sourceType?: string | null;
  sourceRef?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
