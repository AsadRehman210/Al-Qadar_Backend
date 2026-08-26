import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AmountMode = "fixed" | "pct_basic" | "pct_gross";

export interface ISpecialPaymentTypeModel extends Document {
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  amountMode?: AmountMode | null;
  amountValue?: number | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const specialPaymentTypeSchema: Schema<ISpecialPaymentTypeModel> = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    icon: { type: String, default: null },
    amountMode: { type: String, enum: ["fixed", "pct_basic", "pct_gross"], default: "fixed" },
    amountValue: { type: Number, required: true, default: 0 },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "special_payment_type",
  }
);

// Serves special-payment-type-service.ts's getAll list (tenant-scoped, sorted _id:-1).
specialPaymentTypeSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const SpecialPaymentTypeModel: Model<ISpecialPaymentTypeModel> = model<ISpecialPaymentTypeModel>(
  "SpecialPaymentType",
  specialPaymentTypeSchema
);
