import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AssetRequestStatus = "Pending" | "Approved" | "Rejected" | "Fulfilled";
export type AssetRequestPriority = "Low" | "Normal" | "High" | "Urgent";

// Standalone request-to-own workflow — deliberately NOT folded into the
// 15-type Employee Request engine (employee-request-service.ts): that
// engine's two-stage Manager->HR approval models leave/loan/expense
// decisions against an employee's own record, not an inventory-assignment
// decision an Admin makes directly against the Asset register. A single
// admin-decides Pending->Approved/Rejected->Fulfilled flow matches the
// actual shape of this workflow without bending either system.
export interface IAssetRequestModel extends Document {
  employeeId: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId | null;
  justification?: string | null;
  priority?: AssetRequestPriority | null;
  status?: AssetRequestStatus | null;
  requestedDate?: Date | null;
  decidedBy?: mongoose.Types.ObjectId | null;
  decidedDate?: Date | null;
  decisionNotes?: string | null;
  fulfilledAssetId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const assetRequestSchema: Schema<IAssetRequestModel> = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "AssetCategory", default: null },
    justification: { type: String, default: null },
    priority: { type: String, enum: ["Low", "Normal", "High", "Urgent"], default: "Normal" },
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Fulfilled"], default: "Pending" },
    requestedDate: { type: Date, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    decidedDate: { type: Date, default: null },
    decisionNotes: { type: String, default: null },
    fulfilledAssetId: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "asset_request",
  }
);

// Serves asset-request-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
assetRequestSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const AssetRequestModel: Model<IAssetRequestModel> = model<IAssetRequestModel>(
  "AssetRequest",
  assetRequestSchema
);
