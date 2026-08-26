import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IVariantModel extends Document {
  productId?: mongoose.Types.ObjectId | null;
  variantName?: string | null;
  sku?: string | null;
  attributes?: Record<string, string> | null;
  costPrice?: number | null;
  salePrice?: number | null;
  // Unit of measure (pcs/kg/box/...), set once at variant creation so
  // Purchase/Sale line rows can display it instead of asking for it
  // (and risking inconsistent spellings) on every single transaction.
  unit?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// The only thing ever actually purchased or sold — its own SKU/cost/price.
// Physical stockQuantity is deliberately NOT stored here: Warehouse's
// StockLevel is the single source of truth (see warehouse module), read via
// the Inventory Stock aggregation view.
const variantSchema: Schema<IVariantModel> = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantName: { type: String, default: "" },
    sku: { type: String, required: true },
    attributes: { type: Schema.Types.Mixed, default: {} },
    costPrice: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    unit: { type: String, default: "pcs" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "product_variant",
  }
);

// A tenant can't have two variants sharing the same SKU.
variantSchema.index({ adminId: 1, merchantId: 1, sku: 1 }, { unique: true });

// Serves variant-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
variantSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const VariantModel: Model<IVariantModel> = model<IVariantModel>("Variant", variantSchema);
