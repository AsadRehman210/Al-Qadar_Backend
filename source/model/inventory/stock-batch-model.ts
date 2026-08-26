import mongoose, { Document, Schema, Model, model } from "mongoose";

// Batch/expiry tracking — written alongside adjustStock() whenever a Purchase
// receipt (or Production output) adds stock at a specific cost/expiry, so
// FEFO/expiry reporting has a real record to read instead of only a running
// total on StockLevel.
export interface IStockBatchModel extends Document {
  variantId?: mongoose.Types.ObjectId | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  batchNo?: string | null;
  qty?: number | null;
  // Original qty (above) never changes after receipt — this is what's left
  // un-sold, decremented as Sale Invoices that pick this batch get
  // Delivered. What FEFO batch pickers and availability checks read.
  remainingQty?: number | null;
  unitCost?: number | null;
  expiryDate?: Date | null;
  receivedDate?: Date | null;
  sourceType?: string | null;
  sourceRef?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const stockBatchSchema: Schema<IStockBatchModel> = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    batchNo: { type: String, default: null },
    qty: { type: Number, required: true },
    remainingQty: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
    expiryDate: { type: Date, default: null },
    receivedDate: { type: Date, default: Date.now },
    sourceType: { type: String, default: null },
    sourceRef: { type: String, default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "stock_batch",
  }
);

// Serves the FEFO consumption lookup (stock-issue/production/stock-transfer
// services' consumeFefo: variantId+warehouseId+remainingQty>0, sorted expiryDate:1) —
// the hottest query on this collection, runs on every stock-out.
stockBatchSchema.index({ variantId: 1, warehouseId: 1, remainingQty: 1, expiryDate: 1 });
// Serves stock-batch-service.ts's getAll list (tenant-scoped, sorted expiryDate:1).
stockBatchSchema.index({ adminId: 1, merchantId: 1, expiryDate: 1 });

export const StockBatchModel: Model<IStockBatchModel> = model<IStockBatchModel>("StockBatch", stockBatchSchema);
