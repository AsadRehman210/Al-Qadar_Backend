import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IAssetCategoryModel extends Document {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Flat list, same shape as product Category — no nesting.
const assetCategorySchema: Schema<IAssetCategoryModel> = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "asset_category",
  }
);

// Serves asset-category-service.ts's getAll list (tenant-scoped, sorted name:1).
assetCategorySchema.index({ adminId: 1, merchantId: 1, name: 1 });

export const AssetCategoryModel: Model<IAssetCategoryModel> = model<IAssetCategoryModel>(
  "AssetCategory",
  assetCategorySchema
);
