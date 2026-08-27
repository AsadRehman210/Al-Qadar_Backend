import mongoose, { Document, Schema, Model, model } from "mongoose";

export type PurchaseStatus = "Draft" | "Ordered" | "Transit" | "Received";
export type PurchasePaymentStatus = "Pending" | "Partial" | "Cleared";

export interface IPurchaseLine {
  variantId: mongoose.Types.ObjectId;
  productName?: string | null;
  qty: number;
  price: number;
  unit?: string | null;
  expiryDate?: Date | null;
  // undefined/null = falls back to the invoice's own taxPercent ("same for
  // all products"); set = this line's own override ("different per product").
  taxPercent?: number | null;
  // Always populated at save time with this line's actual computed tax
  // amount (qty*price * its effective rate), regardless of same/different
  // mode — so every product is self-describing without needing to fall
  // back to the invoice-level rate to know what it cost in tax.
  taxAmount?: number | null;
  // Landed per-unit cost — price with its own effective tax rate folded in
  // (price * (1 + rate/100)). Saved at create/update time (not only when
  // the invoice is later marked Received), and reused as-is by the receive
  // step for the stock batch's unitCost / weighted-average roll-up, so the
  // number shown while entering the purchase is exactly what lands in stock.
  unitCost?: number | null;
}

export interface IPurchasePaymentEntry {
  date: Date;
  amount: number;
  method?: string | null;
  reference?: string | null;
}

// Purchase Order is deliberately NOT a separate entity — status stages
// (Draft -> Ordered -> Transit -> Received) simulate the PO lifecycle on
// this one record, matching the frontend's existing behavior exactly.
export interface IPurchaseInvoiceModel extends Document {
  invoiceNumber?: string | null;
  supplierId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  expectedDelivery?: Date | null;
  receivedDate?: Date | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  receiverName?: string | null;
  // Invoice-wide, not per-line — a single purchase is either a raw-material
  // buy or a finished-goods buy, never a mix (see the "Type of Product"
  // selector on the add/edit form).
  productType?: string | null;
  products?: IPurchaseLine[];
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  // Whether this invoice's tax is a recoverable input-VAT credit (true,
  // default — folds into VAT Receivable at Received, product cost stays
  // net-of-tax) or a blocked/non-recoverable cost (false — folds into
  // product cost/COGS instead, no VAT Receivable posted). Set at creation,
  // locked once Received.
  taxRecoverable?: boolean | null;
  total?: number | null;
  status?: PurchaseStatus | null;
  stockApplied?: boolean | null;
  paymentStatus?: PurchasePaymentStatus | null;
  paymentHistory?: IPurchasePaymentEntry[];
  // Cash actually received back from the supplier — separate from
  // paymentHistory (money out) since a refund is money coming the other
  // way. Populated only via addRefund.
  refundHistory?: IPurchasePaymentEntry[];
  notes?: string | null;
  currency?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const lineSchema = new Schema<IPurchaseLine>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    productName: { type: String, default: null },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
    unit: { type: String, default: "pcs" },
    expiryDate: { type: Date, default: null },
    taxPercent: { type: Number, default: null },
    taxAmount: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
  },
  { _id: false }
);

const paymentEntrySchema = new Schema<IPurchasePaymentEntry>(
  {
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    method: { type: String, default: null },
    reference: { type: String, default: null },
  },
  { _id: false }
);

const purchaseInvoiceSchema: Schema<IPurchaseInvoiceModel> = new Schema(
  {
    invoiceNumber: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    date: { type: Date, required: true },
    expectedDelivery: { type: Date, default: null },
    receivedDate: { type: Date, default: null },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    receiverName: { type: String, default: null },
    productType: { type: String, default: null },
    products: { type: [lineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    taxRecoverable: { type: Boolean, default: true },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ["Draft", "Ordered", "Transit", "Received"], default: "Draft" },
    // Guards the receive-stock effect so it only ever fires once.
    stockApplied: { type: Boolean, default: false },
    paymentStatus: { type: String, enum: ["Pending", "Partial", "Cleared"], default: "Pending" },
    paymentHistory: { type: [paymentEntrySchema], default: [] },
    refundHistory: { type: [paymentEntrySchema], default: [] },
    notes: { type: String, default: null },
    currency: { type: String, default: "SAR" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "purchase_invoice",
  }
);

// Serves purchase-invoice-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
purchaseInvoiceSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });
// Serves purchase-invoice-service.ts's supplier-statement query (tenant + supplierId, sorted date:1).
purchaseInvoiceSchema.index({ adminId: 1, merchantId: 1, supplierId: 1, date: 1 });

export const PurchaseInvoiceModel: Model<IPurchaseInvoiceModel> = model<IPurchaseInvoiceModel>(
  "PurchaseInvoice",
  purchaseInvoiceSchema
);
