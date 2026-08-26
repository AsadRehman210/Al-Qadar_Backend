export interface quotationLineDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  productName?: string | null;
  qty: number;
  price: number;
  costPrice?: number | null;
  unit?: string | null;
  batchId?: string | null;
  expiryDate?: Date | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
}

export interface quotationDto {
  id: string;
  quoteNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  date?: Date | null;
  validUntil?: Date | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  lines?: quotationLineDto[];
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  currency?: string | null;
  status?: string | null;
  notes?: string | null;
  convertedInvoiceId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
