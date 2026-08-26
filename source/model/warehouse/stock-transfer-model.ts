import mongoose, { Document, Schema, Model, model } from "mongoose";

export type StockTransferStatus = "Pending" | "Completed" | "Cancelled";

export interface IStockTransferItem {
  variantId: mongoose.Types.ObjectId;
  qty: number;
}

export interface IStockTransferModel extends Document {
  transferNo?: string | null;
  fromWarehouseId?: mongoose.Types.ObjectId | null;
  toWarehouseId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  status?: StockTransferStatus | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  notes?: string | null;
  items?: IStockTransferItem[];
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const itemSchema = new Schema<IStockTransferItem>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

const stockTransferSchema: Schema<IStockTransferModel> = new Schema(
  {
    transferNo: { type: String, required: true },
    fromWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    toWarehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["Pending", "Completed", "Cancelled"], default: "Pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    notes: { type: String, default: null },
    items: { type: [itemSchema], default: [] },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "stock_transfer",
  }
);

// Serves stock-transfer-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
stockTransferSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const StockTransferModel: Model<IStockTransferModel> = model<IStockTransferModel>(
  "StockTransfer",
  stockTransferSchema
);
