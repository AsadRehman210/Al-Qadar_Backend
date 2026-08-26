import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface ICategoryModel extends Document {
  name?: string | null;
  description?: string | null;
  status?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Flat list — categories are never nested (no parent field), matching the
// frontend's deliberate removal of sub-categories.
const categorySchema: Schema<ICategoryModel> = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "product_category",
  }
);

// Serves category-service.ts's getAll list (tenant-scoped, sorted name:1).
categorySchema.index({ adminId: 1, merchantId: 1, name: 1 });

export const CategoryModel: Model<ICategoryModel> = model<ICategoryModel>("Category", categorySchema);
