import mongoose, { Document, Schema, Model, model } from "mongoose";

// The single source of truth for physical stock quantities — nothing else
// in the system stores its own copy of a quantity. Keyed by
// (warehouseId, variantId); display fields (productName/sku) are always
// derived live from Variant, never duplicated here.
export interface IStockLevelModel extends Document {
  warehouseId?: mongoose.Types.ObjectId | null;
  variantId?: mongoose.Types.ObjectId | null;
  qty?: number | null;
  minQty?: number | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const stockLevelSchema: Schema<IStockLevelModel> = new Schema(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    qty: { type: Number, default: 0 },
    minQty: { type: Number, default: 0 },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "stock_level",
  }
);

stockLevelSchema.index({ adminId: 1, merchantId: 1, warehouseId: 1, variantId: 1 }, { unique: true });

// Serves stock-level-service.ts's getStockByVariant/getStockTotalsByVariantIds
// (tenant + variantId, across all warehouses) — doesn't hit the unique index
// above since warehouseId isn't part of this filter.
stockLevelSchema.index({ adminId: 1, merchantId: 1, variantId: 1 });

export const StockLevelModel: Model<IStockLevelModel> = model<IStockLevelModel>("StockLevel", stockLevelSchema);
