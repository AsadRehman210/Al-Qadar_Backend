export interface productionRawLineDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  quantity: number;
  actualQuantity?: number | null;
}

export interface productionOtherCostLineDto {
  label: string;
  amount: number;
}

export interface productionOrderDto {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  scheduledDate?: Date | null;
  completedDate?: Date | null;
  outputVariantId?: string | null;
  outputVariantName?: string | null;
  outputQuantity?: number | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  notes?: string | null;
  rawLines?: productionRawLineDto[];
  otherCostLines?: productionOtherCostLineDto[];
  unitCost?: number | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
