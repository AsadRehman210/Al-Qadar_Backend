import mongoose, { Document, Schema, Model, model } from "mongoose";

export type ProductType = "Finished Product" | "Raw Material";

export interface IProductModel extends Document {
  productName?: string | null;
  categoryId?: mongoose.Types.ObjectId | null;
  productType?: ProductType | null;
  status?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Deliberately bare — a name linked to a category, plus productType which
// drives raw-material vs finished-good logic across Production/Purchases.
// Every other attribute (SKU, cost, price, stock) lives on Variant, never
// here — matches the frontend's productFakeData.js shape exactly.
const productSchema: Schema<IProductModel> = new Schema(
  {
    productName: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    productType: {
      type: String,
      enum: ["Finished Product", "Raw Material"],
      default: "Finished Product",
    },
    status: { type: String, default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "product",
  }
);

// Serves product-service.ts's getAll list (tenant-scoped, sorted productName:1).
productSchema.index({ adminId: 1, merchantId: 1, productName: 1 });

export const ProductModel: Model<IProductModel> = model<IProductModel>("Product", productSchema);
