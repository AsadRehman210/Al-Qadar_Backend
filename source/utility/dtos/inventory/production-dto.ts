export interface productionRawLineDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  quantity: number;
  costPrice?: number | null;
}

export interface productionOtherCostLineDto {
  label: string;
  amount: number;
}

export interface productionConsumedBatchDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  batchId: string;
  qty: number;
  unitCost?: number | null;
  expiryDate?: string | null;
}

export interface productionOrderDto {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  scheduledDate?: string | null;
  completedDate?: string | null;
  outputVariantId?: string | null;
  outputVariantName?: string | null;
  outputQuantity?: number | null;
  actualOutputQuantity?: number | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  outputWarehouseId?: string | null;
  outputWarehouseName?: string | null;
  outputExpiryDate?: string | null;
  outputBatchNo?: string | null;
  outputBatchId?: string | null;
  notes?: string | null;
  rawLines?: productionRawLineDto[];
  otherCostLines?: productionOtherCostLineDto[];
  consumedBatches?: productionConsumedBatchDto[];
  quarantineLotId?: string | null;
  quarantineLotNumber?: string | null;
  quarantineQty?: number | null;
  unitCost?: number | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
