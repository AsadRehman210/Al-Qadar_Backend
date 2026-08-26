import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IPFAccountModel extends Document {
  employeeId?: mongoose.Types.ObjectId | null;
  pfAccountNo?: string | null;
  currentBalance?: number | null;
  totalEmployeeContrib?: number | null;
  totalEmployerContrib?: number | null;
  totalWithdrawn?: number | null;
  status?: "Active" | "Inactive" | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// One per employee — never created directly by the client; find-or-created
// the first time a PFContribution is posted for that employee (see pf-service.ts).
const pfAccountSchema: Schema<IPFAccountModel> = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    pfAccountNo: { type: String, required: true },
    currentBalance: { type: Number, default: 0 },
    totalEmployeeContrib: { type: Number, default: 0 },
    totalEmployerContrib: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "pf_account",
  }
);

pfAccountSchema.index({ adminId: 1, merchantId: 1, employeeId: 1 }, { unique: true });

export const PFAccountModel: Model<IPFAccountModel> = model<IPFAccountModel>("PFAccount", pfAccountSchema);
