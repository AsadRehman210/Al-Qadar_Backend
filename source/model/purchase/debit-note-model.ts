import mongoose, { Document, Schema, Model, model } from "mongoose";

export type DebitNoteStatus = "Draft" | "Approved" | "Applied" | "Voided";

export interface IDebitNoteLine {
  variantId: mongoose.Types.ObjectId;
  productName?: string | null;
  qty: number;
  price: number;
  unit?: string | null;
  // Which specific StockBatch (created when the original purchase was
  // Received) these returned units are coming out of — unlike Purchase
  // Invoice's own lines (which never reference a batch, only create one),
  // a debit note return has to point at an existing batch so its
  // remainingQty stays in sync with the aggregate StockLevel total.
  batchId?: mongoose.Types.ObjectId | null;
  expiryDate?: Date | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  unitCost?: number | null;
}

export interface IDebitNoteModel extends Document {
  dnNumber?: string | null;
  supplierId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  originalInvoiceId?: mongoose.Types.ObjectId | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  reason?: string | null;
  products?: IDebitNoteLine[];
  discount?: number | null;
  subtotal?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  total?: number | null;
  currency?: string | null;
  status?: DebitNoteStatus | null;
  notes?: string | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  stockApplied?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const lineSchema = new Schema<IDebitNoteLine>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    productName: { type: String, default: null },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
    unit: { type: String, default: "pcs" },
    batchId: { type: Schema.Types.ObjectId, ref: "StockBatch", default: null },
    expiryDate: { type: Date, default: null },
    taxPercent: { type: Number, default: null },
    taxAmount: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
  },
  { _id: false }
);

const debitNoteSchema: Schema<IDebitNoteModel> = new Schema(
  {
    dnNumber: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    date: { type: Date, required: true },
    originalInvoiceId: { type: Schema.Types.ObjectId, ref: "PurchaseInvoice", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    reason: { type: String, default: null },
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
    collection: "debit_note",
  }
);

// Serves debit-note-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
debitNoteSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const DebitNoteModel: Model<IDebitNoteModel> = model<IDebitNoteModel>("DebitNote", debitNoteSchema);
