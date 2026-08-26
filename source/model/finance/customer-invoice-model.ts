import mongoose, { Document, Schema, Model, model } from "mongoose";

export type CustomerInvoiceStatus = "Draft" | "Sent" | "Partial" | "Paid" | "Cancelled";

export interface ICustomerInvoiceLine {
  description: string;
  amount: number;
  revenueAccountId: mongoose.Types.ObjectId;
}

export interface ICustomerInvoiceModel extends Document {
  customerName?: string | null;
  customerContact?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  dueDate?: Date | null;
  lines?: ICustomerInvoiceLine[];
  subtotal?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  // total = subtotal + vatAmount — the actual amount owed, what paidToDate
  // and balanceDue are computed against.
  total?: number | null;
  // Paid-to-date only ever advances via Phase 5's shared Payment write path —
  // a Customer Invoice never records its own payments.
  paidToDate?: number | null;
  currency?: string | null;
  status?: CustomerInvoiceStatus | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const customerInvoiceLineSchema = new Schema<ICustomerInvoiceLine>(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    revenueAccountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
  },
  { _id: false }
);

const customerInvoiceSchema: Schema<ICustomerInvoiceModel> = new Schema(
  {
    customerName: { type: String, required: true },
    customerContact: { type: String, default: null },
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    lines: { type: [customerInvoiceLineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paidToDate: { type: Number, default: 0 },
    currency: { type: String, default: "SAR" },
    status: { type: String, enum: ["Draft", "Sent", "Partial", "Paid", "Cancelled"], default: "Draft" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "customer_invoice",
  }
);

// Serves customer-invoice-service.ts's getAll list (tenant-scoped, sorted _id:-1).
customerInvoiceSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const CustomerInvoiceModel: Model<ICustomerInvoiceModel> = model<ICustomerInvoiceModel>(
  "CustomerInvoice",
  customerInvoiceSchema
);
