import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AssetAuditStatus = "In Progress" | "Completed";
export type AssetAuditResultStatus = "Pending" | "Verified" | "Missing" | "Damaged";

export interface IAssetAuditResult {
  assetId: mongoose.Types.ObjectId;
  status?: AssetAuditResultStatus | null;
  notes?: string | null;
  checkedAt?: Date | null;
}

export interface IAssetAuditModel extends Document {
  startedAt?: Date | null;
  startedBy?: mongoose.Types.ObjectId | null;
  status?: AssetAuditStatus | null;
  completedAt?: Date | null;
  results: IAssetAuditResult[];
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const assetAuditResultSchema = new Schema<IAssetAuditResult>(
  {
    assetId: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
    status: { type: String, enum: ["Pending", "Verified", "Missing", "Damaged"], default: "Pending" },
    notes: { type: String, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false }
);

// One session snapshots every non-Disposed asset at start time (see
// asset-audit-service.ts::start) — results is a fixed-size checklist filled
// in as the physical count proceeds, not a growable log.
const assetAuditSchema: Schema<IAssetAuditModel> = new Schema(
  {
    startedAt: { type: Date, default: null },
    startedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    status: { type: String, enum: ["In Progress", "Completed"], default: "In Progress" },
    completedAt: { type: Date, default: null },
    results: { type: [assetAuditResultSchema], default: [] },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "asset_audit",
  }
);

// Serves asset-audit-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
assetAuditSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const AssetAuditModel: Model<IAssetAuditModel> = model<IAssetAuditModel>("AssetAudit", assetAuditSchema);
