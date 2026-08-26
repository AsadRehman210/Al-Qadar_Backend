import mongoose, { Document, Schema, Model, model } from "mongoose";

export type QuotationStatus = "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired" | "Converted";

export interface IQuotationLine {
  variantId: mongoose.Types.ObjectId;
  productName?: string | null;
  qty: number;
  price: number;
  costPrice?: number | null;
  unit?: string | null;
  // Which physical batch this line was quoted against — purely informational
  // reference (costing/expiry), never reserved or consumed: a quotation
  // never moves real stock. Re-validated for real (and actually consumed)
  // only when/if this quote is converted to a Sale Invoice.
  batchId?: mongoose.Types.ObjectId | null;
  expiryDate?: Date | null;
  // undefined/null = falls back to the quotation's own taxPercent ("same for
  // all products"); set = this line's own override ("different per
  // product"). Same convention as Sale/Purchase Invoice's per-line tax.
  taxPercent?: number | null;
  // Always populated at save time with this line's actual computed tax
  // amount (its subtotal * its effective rate), regardless of same/different
  // mode.
  taxAmount?: number | null;
}

export interface IQuotationModel extends Document {
  quoteNumber?: string | null;
  customerId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  validUntil?: Date | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  lines?: IQuotationLine[];
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  currency?: string | null;
  status?: QuotationStatus | null;
  notes?: string | null;
  convertedInvoiceId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const lineSchema = new Schema<IQuotationLine>(
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

const quotationSchema: Schema<IQuotationModel> = new Schema(
  {
    quoteNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    date: { type: Date, required: true },
    validUntil: { type: Date, default: null },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    lines: { type: [lineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: "SAR" },
    status: { type: String, enum: ["Draft", "Sent", "Accepted", "Rejected", "Expired", "Converted"], default: "Draft" },
    notes: { type: String, default: null },
    convertedInvoiceId: { type: Schema.Types.ObjectId, ref: "SaleInvoice", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "quotation",
  }
);

// Serves quotation-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
quotationSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const QuotationModel: Model<IQuotationModel> = model<IQuotationModel>("Quotation", quotationSchema);
