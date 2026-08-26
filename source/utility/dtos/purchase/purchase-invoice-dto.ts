export interface purchaseLineDto {
  variantId: string;
  variantName?: string | null;
  sku?: string | null;
  productName?: string | null;
  qty: number;
  price: number;
  unit?: string | null;
  expiryDate?: string | null;
  // Per-line tax override — undefined/null means "use the invoice-level
  // taxPercent" (the "same for all products" mode); a set value overrides
  // it for just this line (the "different per product" mode).
  taxPercent?: number | null;
  // Always populated — this line's actual computed tax amount, regardless
  // of same/different mode.
  taxAmount?: number | null;
  // Landed per-unit cost (price with its own effective tax folded in).
  unitCost?: number | null;
}

export interface purchasePaymentEntryDto {
  date: string | null;
  amount: number;
  method?: string | null;
  reference?: string | null;
}

export interface purchaseReturnedItemDto {
  dnId: string;
  dnNumber: string | null;
  dnStatus: string | null;
  date: string | null;
  reason: string | null;
  variantId: string;
  productName: string | null;
  qty: number;
  price: number;
}

export interface purchaseInvoiceDto {
  id: string;
  invoiceNumber?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  date?: string | null;
  expectedDelivery?: string | null;
  receivedDate?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  receiverName?: string | null;
  productType?: string | null;
  products?: purchaseLineDto[];
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  status?: string | null;
  stockApplied?: boolean | null;
  paymentStatus?: string | null;
  paymentHistory?: purchasePaymentEntryDto[];
  refundHistory?: purchasePaymentEntryDto[];
  balanceDue?: number | null;
  // Sum of Applied (non-Voided) debit notes issued against this invoice —
  // what the business no longer owes the supplier because of returns.
  debitedAmount?: number | null;
  // Cash the supplier owes back — only non-zero when the business had
  // already paid more than the invoice is worth net of debits.
  refundDue?: number | null;
  refundedAmount?: number | null;
  // Real cash paid (sum of paymentHistory) — distinct from
  // `total - balanceDue`, which stops being the same number once a debit
  // note changes what's actually owed.
  paidAmount?: number | null;
  // Every item returned via a linked (non-Voided) debit note, flattened
  // across all such notes — only populated on the single-record get().
  returnedItems?: purchaseReturnedItemDto[];
  notes?: string | null;
  currency?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
