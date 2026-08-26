import mongoose, { Document, Schema, Model, model } from "mongoose";

// "receipt" = money coming in (customer payment against an invoice, or a
// standalone misc receipt); "disbursement" = money going out (vendor
// payment against a bill, or a standalone misc payment).
export type PaymentDirection = "receipt" | "disbursement";

export interface IPaymentModel extends Document {
  date?: Date | null;
  direction?: PaymentDirection | null;
  amount?: number | null;
  method?: string | null;
  reference?: string | null;
  party?: string | null;
  // The cash/bank side of the entry — every payment always has exactly one.
  bankAccountId?: mongoose.Types.ObjectId | null;
  // Exactly one of invoiceId/billId is set for an allocated payment; both
  // are null for a standalone one-off (contraAccountId is required instead).
  invoiceId?: mongoose.Types.ObjectId | null;
  billId?: mongoose.Types.ObjectId | null;
  contraAccountId?: mongoose.Types.ObjectId | null;
  journalEntryId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const paymentSchema: Schema<IPaymentModel> = new Schema(
  {
    date: { type: Date, required: true },
    direction: { type: String, enum: ["receipt", "disbursement"], required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: null },
    reference: { type: String, default: null },
    party: { type: String, default: null },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "CustomerInvoice", default: null },
    billId: { type: Schema.Types.ObjectId, ref: "VendorBill", default: null },
    contraAccountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", default: null },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "payment",
  }
);

// Serves payment-service.ts's getAll list (tenant-scoped, sorted _id:-1).
paymentSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const PaymentModel: Model<IPaymentModel> = model<IPaymentModel>("Payment", paymentSchema);
