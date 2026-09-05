import mongoose, { Document, Schema, Model, model } from "mongoose";

export type QuarantineLotStatus = "Open" | "Partial" | "Consumed";

export interface IQuarantineLotModel extends Document {
  lotNumber?: string | null;
  status?: QuarantineLotStatus | null;
  variantId?: mongoose.Types.ObjectId | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  qty?: number | null;
  remainingQty?: number | null;
  reason?: string | null;
  sourceType?: string | null;
  sourceRef?: string | null;
  sourceId?: mongoose.Types.ObjectId | null;
  originalInvoiceId?: mongoose.Types.ObjectId | null;
  customerId?: mongoose.Types.ObjectId | null;
  productName?: string | null;
  costPrice?: number | null;
  unit?: string | null;
  expiryDate?: Date | null;
  currency?: string | null;
  productionOrderId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const quarantineLotSchema: Schema<IQuarantineLotModel> = new Schema(
  {
    lotNumber: { type: String, required: true },
    status: { type: String, enum: ["Open", "Partial", "Consumed"], default: "Open" },
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    qty: { type: Number, required: true },
    remainingQty: { type: Number, required: true },
    reason: { type: String, default: null },
    sourceType: { type: String, default: "Credit Note" },
    sourceRef: { type: String, default: null },
    sourceId: { type: Schema.Types.ObjectId, default: null },
    originalInvoiceId: { type: Schema.Types.ObjectId, ref: "SaleInvoice", default: null },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    productName: { type: String, default: null },
    costPrice: { type: Number, default: 0 },
    unit: { type: String, default: null },
    expiryDate: { type: Date, default: null },
    currency: { type: String, default: "SAR" },
    productionOrderId: { type: Schema.Types.ObjectId, ref: "ProductionOrder", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "quarantine_lot",
  }
);

quarantineLotSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });
quarantineLotSchema.index({ sourceId: 1, sourceType: 1 });

export const QuarantineLotModel: Model<IQuarantineLotModel> = model<IQuarantineLotModel>(
  "QuarantineLot",
  quarantineLotSchema
);
