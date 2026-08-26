export interface stockTransferItemDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  qty: number;
}

export interface stockTransferDto {
  id: string;
  transferNo?: string | null;
  fromWarehouseId?: string | null;
  fromWarehouseName?: string | null;
  toWarehouseId?: string | null;
  toWarehouseName?: string | null;
  date?: Date | null;
  status?: string | null;
  approvedBy?: string | null;
  notes?: string | null;
  items?: stockTransferItemDto[];
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
