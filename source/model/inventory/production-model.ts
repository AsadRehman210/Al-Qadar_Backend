import mongoose, { Document, Schema, Model, model } from "mongoose";

export type ProductionStatus = "Draft" | "InProgress" | "Completed" | "Cancelled";

export interface IProductionRawLine {
  variantId: mongoose.Types.ObjectId;
  quantity: number;
  actualQuantity?: number | null;
}

export interface IProductionOtherCostLine {
  label: string;
  amount: number;
}

export interface IProductionOrderModel extends Document {
  orderNumber?: string | null;
  status?: ProductionStatus | null;
  scheduledDate?: Date | null;
  completedDate?: Date | null;
  outputVariantId?: mongoose.Types.ObjectId | null;
  outputQuantity?: number | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  notes?: string | null;
  rawLines?: IProductionRawLine[];
  otherCostLines?: IProductionOtherCostLine[];
  unitCost?: number | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const rawLineSchema = new Schema<IProductionRawLine>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    quantity: { type: Number, required: true },
    actualQuantity: { type: Number, default: null },
  },
  { _id: false }
);

const otherCostLineSchema = new Schema<IProductionOtherCostLine>(
  {
    label: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const productionOrderSchema: Schema<IProductionOrderModel> = new Schema(
  {
    orderNumber: { type: String, required: true },
    status: { type: String, enum: ["Draft", "InProgress", "Completed", "Cancelled"], default: "Draft" },
    scheduledDate: { type: Date, default: null },
    completedDate: { type: Date, default: null },
    outputVariantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    outputQuantity: { type: Number, required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    notes: { type: String, default: null },
    rawLines: { type: [rawLineSchema], default: [] },
    otherCostLines: { type: [otherCostLineSchema], default: [] },
    unitCost: { type: Number, default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "production_order",
  }
);

// Serves production-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
productionOrderSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const ProductionOrderModel: Model<IProductionOrderModel> = model<IProductionOrderModel>(
  "ProductionOrder",
  productionOrderSchema
);
