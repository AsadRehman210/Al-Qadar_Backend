import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IMerchantPaymentModel extends Document {
  merchantId?: mongoose.Types.ObjectId | null;
  amount?: number | null;
  method?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  reference?: string | null;
  notes?: string | null;
  recordedBy?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// The durable "payment record... throughout" ledger — one row per payment/
// renewal, whether recorded by Super Admin or by the Merchant's own Admin.
// `merchantId` doubles as both "which merchant this payment is for" and the
// tenant-scope field of the same name (they're the same thing here);
// `adminId` mirrors that merchant's own parent Admin at the time of payment
// (tenant scope), not who recorded it — see `recordedBy` for that.
const merchantPaymentSchema: Schema<IMerchantPaymentModel> = new Schema(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: false },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    reference: { type: String, required: false },
    notes: { type: String, required: false },
    recordedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "merchant_payment",
  }
);

// Serves merchant-service.ts's getPaymentHistory (merchantId, sorted createdAt:-1).
merchantPaymentSchema.index({ merchantId: 1, createdAt: -1 });

export const MerchantPaymentModel: Model<IMerchantPaymentModel> = model<IMerchantPaymentModel>(
  "MerchantPayment",
  merchantPaymentSchema
);
