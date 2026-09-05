import mongoose, { Document, Schema, Model, model } from "mongoose";

export type ProductionStatus = "Draft" | "InProgress" | "Completed" | "Cancelled" | "Reversed";

export interface IProductionRawLine {
  variantId: mongoose.Types.ObjectId;
  quantity: number;
  costPrice?: number | null;
}

export interface IProductionConsumedBatch {
  variantId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  qty: number;
  unitCost?: number | null;
  expiryDate?: Date | null;
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
  actualOutputQuantity?: number | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  outputWarehouseId?: mongoose.Types.ObjectId | null;
  outputExpiryDate?: Date | null;
  outputBatchNo?: string | null;
  outputBatchId?: mongoose.Types.ObjectId | null;
  notes?: string | null;
  rawLines?: IProductionRawLine[];
  otherCostLines?: IProductionOtherCostLine[];
  consumedBatches?: IProductionConsumedBatch[];
  quarantineLotId?: mongoose.Types.ObjectId | null;
  quarantineQty?: number | null;
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
    costPrice: { type: Number, default: null },
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

const consumedBatchSchema = new Schema<IProductionConsumedBatch>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "StockBatch", required: true },
    qty: { type: Number, required: true },
    unitCost: { type: Number, default: 0 },
    expiryDate: { type: Date, default: null },
  },
  { _id: false }
);

const productionOrderSchema: Schema<IProductionOrderModel> = new Schema(
  {
    orderNumber: { type: String, required: true },
    status: { type: String, enum: ["Draft", "InProgress", "Completed", "Cancelled", "Reversed"], default: "Draft" },
    scheduledDate: { type: Date, default: null },
    completedDate: { type: Date, default: null },
    outputVariantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    outputQuantity: { type: Number, required: true },
    actualOutputQuantity: { type: Number, default: null },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    outputWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", default: null },
    outputExpiryDate: { type: Date, default: null },
    outputBatchNo: { type: String, default: null },
    outputBatchId: { type: Schema.Types.ObjectId, ref: "StockBatch", default: null },
    notes: { type: String, default: null },
    rawLines: { type: [rawLineSchema], default: [] },
    otherCostLines: { type: [otherCostLineSchema], default: [] },
    consumedBatches: { type: [consumedBatchSchema], default: [] },
    quarantineLotId: { type: Schema.Types.ObjectId, ref: "QuarantineLot", default: null },
    quarantineQty: { type: Number, default: null },
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
