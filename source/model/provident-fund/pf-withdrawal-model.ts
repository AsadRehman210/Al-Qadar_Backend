import mongoose, { Document, Schema, Model, model } from "mongoose";

export type PFWithdrawalType = "Partial" | "Full";
export type PFWithdrawalStatus = "Pending" | "Approved" | "Rejected" | "Paid";

export interface IPFWithdrawalModel extends Document {
  employeeId?: mongoose.Types.ObjectId | null;
  amount?: number | null;
  reason?: string | null;
  type?: PFWithdrawalType | null;
  status?: PFWithdrawalStatus | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedOn?: Date | null;
  paidOn?: Date | null;
  remarks?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const pfWithdrawalSchema: Schema<IPFWithdrawalModel> = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: false },
    type: { type: String, enum: ["Partial", "Full"], required: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Paid"], default: "Pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    approvedOn: { type: Date, default: null },
    paidOn: { type: Date, default: null },
    remarks: { type: String, default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "pf_withdrawal",
  }
);

// Serves pf-service.ts's getAllWithdrawals list (tenant-scoped, sorted _id:-1).
pfWithdrawalSchema.index({ adminId: 1, merchantId: 1, _id: -1 });
// Serves pf-service.ts's getWithdrawalsByEmployee (employeeId, sorted _id:-1).
pfWithdrawalSchema.index({ employeeId: 1, _id: -1 });

export const PFWithdrawalModel: Model<IPFWithdrawalModel> = model<IPFWithdrawalModel>(
  "PFWithdrawal",
  pfWithdrawalSchema
);
