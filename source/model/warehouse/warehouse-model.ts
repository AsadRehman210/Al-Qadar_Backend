import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IWarehouseModel extends Document {
  code?: string | null;
  name?: string | null;
  location?: string | null;
  manager?: string | null;
  capacity?: number | null;
  unit?: string | null;
  description?: string | null;
  status?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const warehouseSchema: Schema<IWarehouseModel> = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    location: { type: String, default: null },
    manager: { type: String, default: null },
    capacity: { type: Number, default: null },
    unit: { type: String, default: "sqm" },
    description: { type: String, default: null },
    status: { type: String, default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "warehouse",
  }
);

warehouseSchema.index({ adminId: 1, merchantId: 1, code: 1 }, { unique: true });

// Serves warehouse-service.ts's getAll list (tenant-scoped, sorted name:1).
warehouseSchema.index({ adminId: 1, merchantId: 1, name: 1 });

export const WarehouseModel: Model<IWarehouseModel> = model<IWarehouseModel>("Warehouse", warehouseSchema);
