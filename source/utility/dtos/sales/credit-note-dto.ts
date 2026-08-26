export interface creditNoteLineDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  productName?: string | null;
  qty: number;
  price: number;
  costPrice?: number | null;
  unit?: string | null;
  batchId?: string | null;
  expiryDate?: string | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
}

export interface creditNoteDto {
  id: string;
  cnNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  date?: string | null;
  originalInvoiceId?: string | null;
  originalInvoiceNumber?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  reason?: string | null;
  returnType?: string | null;
  products?: creditNoteLineDto[];
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
