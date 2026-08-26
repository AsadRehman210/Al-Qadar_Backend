import mongoose, { Document, Schema, Model, model } from "mongoose";

export type CreditNoteStatus = "Draft" | "Approved" | "Applied" | "Voided";

export interface ICreditNoteLine {
  variantId: mongoose.Types.ObjectId;
  productName?: string | null;
  qty: number;
  price: number;
  costPrice?: number | null;
  unit?: string | null;
  // Which physical batch the returned qty is credited against — snapshotted
  // from the original Sale Invoice line being returned, same reasoning as
  // ISaleLine.batchId (pins cost/expiry to one specific batch).
  batchId?: mongoose.Types.ObjectId | null;
  expiryDate?: Date | null;
  // undefined/null = falls back to the credit note's own taxPercent; set =
  // this line's own override, snapshotted from the original sale line.
  taxPercent?: number | null;
  taxAmount?: number | null;
}

export interface ICreditNoteModel extends Document {
  cnNumber?: string | null;
  customerId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  originalInvoiceId?: mongoose.Types.ObjectId | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  reason?: string | null;
  returnType?: string | null;
  products?: ICreditNoteLine[];
  discount?: number | null;
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  currency?: string | null;
  status?: CreditNoteStatus | null;
  notes?: string | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  stockApplied?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const lineSchema = new Schema<ICreditNoteLine>(
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

const creditNoteSchema: Schema<ICreditNoteModel> = new Schema(
  {
    cnNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    date: { type: Date, required: true },
    originalInvoiceId: { type: Schema.Types.ObjectId, ref: "SaleInvoice", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    reason: { type: String, default: null },
    returnType: { type: String, default: "Full return" },
    products: { type: [lineSchema], default: [] },
    discount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: "SAR" },
    status: { type: String, enum: ["Draft", "Approved", "Applied", "Voided"], default: "Draft" },
    notes: { type: String, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    stockApplied: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "credit_note",
  }
);

// Serves credit-note-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
creditNoteSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const CreditNoteModel: Model<ICreditNoteModel> = model<ICreditNoteModel>("CreditNote", creditNoteSchema);
