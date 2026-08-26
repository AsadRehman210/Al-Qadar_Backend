import mongoose, { Document, Schema, Model, model } from "mongoose";

export type DeliveryStatus = "Pending" | "InTransit" | "Delivered" | "Cancelled";
export type SalePaymentStatus = "Pending" | "Partial" | "Paid";

export interface ISaleLine {
  variantId: mongoose.Types.ObjectId;
  productName?: string | null;
  qty: number;
  price: number;
  costPrice?: number | null;
  unit?: string | null;
  // Which physical batch this line is sold from — a variant can have several
  // batches at different costs/expiries (bought at different times), so this
  // pins the line to one specific batch instead of the variant's blended
  // weighted-average cost. Optional: undefined/null means no batch tracking
  // for this line (falls back to variant.costPrice, the old behavior).
  batchId?: mongoose.Types.ObjectId | null;
  // Snapshotted from the chosen batch at save time, same reasoning as
  // costPrice — never re-read later so it can't drift if the batch changes.
  expiryDate?: Date | null;
  // undefined/null = falls back to the invoice's own taxPercent ("same for
  // all products"); set = this line's own override ("different per product").
  // Same convention as Purchase Invoice's per-line tax.
  taxPercent?: number | null;
  // Always populated at save time with this line's actual computed tax
  // amount (its subtotal * its effective rate), regardless of same/different
  // mode.
  taxAmount?: number | null;
}

export interface ISalePaymentEntry {
  date: Date;
  amount: number;
  method?: string | null;
  reference?: string | null;
}

export interface ISaleInvoiceModel extends Document {
  invoiceNumber?: string | null;
  customerId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  receiverName?: string | null;
  products?: ISaleLine[];
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  shippingAddress?: string | null;
  deliveryDate?: Date | null;
  deliveryStatus?: DeliveryStatus | null;
  stockApplied?: boolean | null;
  paymentStatus?: SalePaymentStatus | null;
  paymentHistory?: ISalePaymentEntry[];
  // Cash actually paid back to the customer — separate from paymentHistory
  // (money in) since a refund is money going the other way. Populated only
  // via addRefund, never touched by anything else.
  refundHistory?: ISalePaymentEntry[];
  notes?: string | null;
  currency?: string | null;
  // Set only when this invoice was created via Quotation's "Convert to
  // invoice" flow — a structured back-link (quoteNumber snapshotted so it's
  // still readable even without a populate) so the UI can show "From
  // Quotation QUO-000123" instead of relying on it being buried in notes.
  convertedFromQuotationId?: mongoose.Types.ObjectId | null;
  convertedFromQuoteNumber?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const lineSchema = new Schema<ISaleLine>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    productName: { type: String, default: null },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
    costPrice: { type: Number, default: 0 },
    unit: { type: String, default: "pcs" },
    batchId: { type: Schema.Types.ObjectId, ref: "StockBatch", default: null },
    expiryDate: { type: Date, default: null },
    taxPercent: { type: Number, default: null },
    taxAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const paymentEntrySchema = new Schema<ISalePaymentEntry>(
  {
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    method: { type: String, default: null },
    reference: { type: String, default: null },
  },
  { _id: false }
);

const saleInvoiceSchema: Schema<ISaleInvoiceModel> = new Schema(
  {
    invoiceNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    date: { type: Date, required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    receiverName: { type: String, default: null },
    products: { type: [lineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    shippingAddress: { type: String, default: null },
    deliveryDate: { type: Date, default: null },
    deliveryStatus: { type: String, enum: ["Pending", "InTransit", "Delivered", "Cancelled"], default: "Pending" },
    // Guards the delivery stock effect so it only ever fires once — never
    // re-derived from deliveryStatus alone, since status can be edited back
    // and forth.
    stockApplied: { type: Boolean, default: false },
    paymentStatus: { type: String, enum: ["Pending", "Partial", "Paid"], default: "Pending" },
    paymentHistory: { type: [paymentEntrySchema], default: [] },
    refundHistory: { type: [paymentEntrySchema], default: [] },
    notes: { type: String, default: null },
    currency: { type: String, default: "SAR" },
    convertedFromQuotationId: { type: Schema.Types.ObjectId, ref: "Quotation", default: null },
    convertedFromQuoteNumber: { type: String, default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "sale_invoice",
  }
);

// Serves sale-invoice-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
saleInvoiceSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });
// Serves sale-invoice-service.ts's customer-statement query (tenant + customerId, sorted date:1).
saleInvoiceSchema.index({ adminId: 1, merchantId: 1, customerId: 1, date: 1 });

export const SaleInvoiceModel: Model<ISaleInvoiceModel> = model<ISaleInvoiceModel>(
  "SaleInvoice",
  saleInvoiceSchema
);
