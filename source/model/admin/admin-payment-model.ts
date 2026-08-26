import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IAdminPaymentModel extends Document {
  adminId?: mongoose.Types.ObjectId | null;
  amount?: number | null;
  method?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  reference?: string | null;
  notes?: string | null;
  recordedBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// The durable payment ledger for an Admin's own subscription to the
// platform — one row per payment/renewal, always recorded by Super Admin
// (an Admin has no one above it to pay itself). Mirrors MerchantPaymentModel.
const adminPaymentSchema: Schema<IAdminPaymentModel> = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: false },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    reference: { type: String, required: false },
    notes: { type: String, required: false },
    recordedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "admin_payment",
  }
);

// Serves admin-service.ts's getPaymentHistory (adminId, sorted createdAt:-1).
adminPaymentSchema.index({ adminId: 1, createdAt: -1 });

export const AdminPaymentModel: Model<IAdminPaymentModel> = model<IAdminPaymentModel>(
  "AdminPayment",
  adminPaymentSchema
);
