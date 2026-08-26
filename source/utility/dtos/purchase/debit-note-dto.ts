export interface debitNoteLineDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  productName?: string | null;
  qty: number;
  price: number;
  unit?: string | null;
  batchId?: string | null;
  expiryDate?: string | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  unitCost?: number | null;
}

export interface debitNoteDto {
  id: string;
  dnNumber?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  date?: string | null;
  originalInvoiceId?: string | null;
  originalInvoiceNumber?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  reason?: string | null;
  products?: debitNoteLineDto[];
  discount?: number | null;
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  currency?: string | null;
  status?: string | null;
  notes?: string | null;
  approvedBy?: string | null;
  stockApplied?: boolean | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
