import mongoose, { Document, Schema, Model, model } from "mongoose";

export type VendorBillStatus = "Draft" | "Approved" | "Partial" | "Paid" | "Cancelled";

export interface IVendorBillLine {
  description: string;
  amount: number;
  expenseAccountId: mongoose.Types.ObjectId;
}

export interface IVendorBillModel extends Document {
  vendorName?: string | null;
  vendorContact?: string | null;
  billNumber?: string | null;
  billDate?: Date | null;
  dueDate?: Date | null;
  lines?: IVendorBillLine[];
  subtotal?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  // total = subtotal + vatAmount — the actual amount owed, what paidToDate
  // and balanceDue are computed against.
  total?: number | null;
  // Paid-to-date is only ever advanced by Phase 5's shared Payment write
  // path — a Vendor Bill never records its own payments.
  paidToDate?: number | null;
  currency?: string | null;
  status?: VendorBillStatus | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const vendorBillLineSchema = new Schema<IVendorBillLine>(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    expenseAccountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
  },
  { _id: false }
);

const vendorBillSchema: Schema<IVendorBillModel> = new Schema(
  {
    vendorName: { type: String, required: true },
    vendorContact: { type: String, default: null },
    billNumber: { type: String, required: true },
    billDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    lines: { type: [vendorBillLineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paidToDate: { type: Number, default: 0 },
    currency: { type: String, default: "SAR" },
    status: { type: String, enum: ["Draft", "Approved", "Partial", "Paid", "Cancelled"], default: "Draft" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "vendor_bill",
  }
);

// Serves vendor-bill-service.ts's getAll list (tenant-scoped, sorted _id:-1).
vendorBillSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const VendorBillModel: Model<IVendorBillModel> = model<IVendorBillModel>(
  "VendorBill",
  vendorBillSchema
);
