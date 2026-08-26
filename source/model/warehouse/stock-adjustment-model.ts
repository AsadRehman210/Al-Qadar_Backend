import mongoose, { Document, Schema, Model, model } from "mongoose";

export type StockAdjustmentType = "add" | "subtract" | "set";

// Immutable audit log entry — one row written per adjustStock() call, never
// updated or deleted. Powers the adjustment-history view and traces every
// quantity change back to the invoice/GRN/transfer that caused it via `reason`.
export interface IStockAdjustmentModel extends Document {
  warehouseId?: mongoose.Types.ObjectId | null;
  variantId?: mongoose.Types.ObjectId | null;
  type?: StockAdjustmentType | null;
  qty?: number | null;
  reason?: string | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  adjustedBy?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const stockAdjustmentSchema: Schema<IStockAdjustmentModel> = new Schema(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    type: { type: String, enum: ["add", "subtract", "set"], required: true },
    qty: { type: Number, required: true },
    reason: { type: String, default: null },
    balanceBefore: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
    adjustedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "stock_adjustment",
  }
);

// Serves stock-level-service.ts's getAdjustmentHistory list (tenant-scoped,
// optionally variantId/warehouseId-filtered, sorted createdAt:-1).
stockAdjustmentSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const StockAdjustmentModel: Model<IStockAdjustmentModel> = model<IStockAdjustmentModel>(
  "StockAdjustment",
  stockAdjustmentSchema
);
