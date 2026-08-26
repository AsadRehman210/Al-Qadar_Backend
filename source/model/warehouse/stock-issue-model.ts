import mongoose, { Document, Schema, Model, model } from "mongoose";

export type StockIssueType = "Internal Use" | "Sample" | "Damage" | "Other";

export interface IStockIssueItem {
  variantId: mongoose.Types.ObjectId;
  qty: number;
}

export interface IStockIssueModel extends Document {
  issueNo?: string | null;
  warehouseId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  issueType?: StockIssueType | null;
  issuedTo?: string | null;
  reference?: string | null;
  notes?: string | null;
  issuedBy?: mongoose.Types.ObjectId | null;
  items?: IStockIssueItem[];
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const itemSchema = new Schema<IStockIssueItem>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

const stockIssueSchema: Schema<IStockIssueModel> = new Schema(
  {
    issueNo: { type: String, required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    date: { type: Date, required: true },
    issueType: { type: String, enum: ["Internal Use", "Sample", "Damage", "Other"], default: "Internal Use" },
    issuedTo: { type: String, default: null },
    reference: { type: String, default: null },
    notes: { type: String, default: null },
    issuedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    items: { type: [itemSchema], default: [] },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "stock_issue",
  }
);

// Serves stock-issue-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
stockIssueSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const StockIssueModel: Model<IStockIssueModel> = model<IStockIssueModel>("StockIssue", stockIssueSchema);
