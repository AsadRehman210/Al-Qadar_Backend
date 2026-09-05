export interface saleLineDto {
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
  // Per-line tax override — undefined/null means "use the invoice-level
  // taxPercent" (the "same for all products" mode); a set value overrides
  // it for just this line (the "different per product" mode).
  taxPercent?: number | null;
  // Always populated — this line's actual computed tax amount.
  taxAmount?: number | null;
}

export interface salePaymentEntryDto {
  date: string | null;
  amount: number;
  method?: string | null;
  reference?: string | null;
}

export interface saleReturnedItemDto {
  cnId: string;
  cnNumber: string | null;
  cnStatus: string | null;
  date: string | null;
  reason: string | null;
  variantId: string;
  productName: string | null;
  qty: number;
  price: number;
  unit?: string | null;
  // Snapshotted from the credit note's own line — needed to work out the
  // profit impact of a return (qty * (price - costPrice)) without the
  // frontend having to re-derive it from the original invoice line.
  costPrice: number;
  taxPercent?: number | null;
  taxAmount?: number | null;
  // qty * price, before tax.
  subtotal?: number | null;
  // qty * price + taxAmount.
  lineTotal?: number | null;
}

export interface saleInvoiceDto {
  id: string;
  invoiceNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  // Invoice day — always derived from createdAt; there is no separate date field.
  date?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  receiverName?: string | null;
  products?: saleLineDto[];
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  shippingAddress?: string | null;
  deliveryDate?: string | null;
  deliveryStatus?: string | null;
  stockApplied?: boolean | null;
  paymentStatus?: string | null;
  paymentHistory?: salePaymentEntryDto[];
  refundHistory?: salePaymentEntryDto[];
  balanceDue?: number | null;
  // Sum of Applied (non-Voided) credit notes issued against this invoice —
  // what the customer no longer owes because of returns.
  creditedAmount?: number | null;
  // Cash the customer is now owed back — only non-zero when they'd already
  // paid more than the invoice is worth net of credits.
  refundDue?: number | null;
  refundedAmount?: number | null;
  // Real cash received (sum of paymentHistory) — distinct from
  // `total - balanceDue`, which stops being the same number once a credit
  // note changes what's actually owed.
  paidAmount?: number | null;
  // Every item returned via a linked (non-Voided) credit note, flattened
  // across all such notes — only populated on the single-record get(), not
  // the list, since it needs each note's own line items.
  returnedItems?: saleReturnedItemDto[];
  notes?: string | null;
  currency?: string | null;
  convertedFromQuotationId?: string | null;
  convertedFromQuoteNumber?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
