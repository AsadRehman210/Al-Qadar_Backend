import mongoose, { Document, Schema, Model, model } from "mongoose";

// One VatConfig row per tenant — the rate/registration number a Customer
// Invoice or Vendor Bill uses to compute its VAT amount at creation time.
export interface IVatConfigModel extends Document {
  rate?: number | null;
  registrationNumber?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const vatConfigSchema: Schema<IVatConfigModel> = new Schema(
  {
    rate: { type: Number, default: 0 },
    registrationNumber: { type: String, default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "vat_config",
  }
);

vatConfigSchema.index({ adminId: 1, merchantId: 1 }, { unique: true });

export const VatConfigModel: Model<IVatConfigModel> = model<IVatConfigModel>(
  "VatConfig",
  vatConfigSchema
);
