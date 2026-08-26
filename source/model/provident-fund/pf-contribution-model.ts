import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IPFContributionModel extends Document {
  employeeId?: mongoose.Types.ObjectId | null;
  month?: string | null;
  basic?: number | null;
  employeeContribution?: number | null;
  employerContribution?: number | null;
  // The rate/multiplier actually used to compute the two amounts above —
  // employeePfPercentage from the employee's own Salary record at the time,
  // employerMultiplier from the tenant's PF Policy at the time. Null for
  // contributions posted manually (not via a payroll run).
  employeePfPercentage?: number | null;
  employerMultiplier?: number | null;
  totalContribution?: number | null;
  balanceAfter?: number | null;
  status?: "Credited" | "Manual" | "Payroll" | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const pfContributionSchema: Schema<IPFContributionModel> = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    month: { type: String, required: true }, // e.g. "2025-03"
    basic: { type: Number, required: true },
    employeeContribution: { type: Number, required: true },
    employerContribution: { type: Number, required: true },
    employeePfPercentage: { type: Number, default: null },
    employerMultiplier: { type: Number, default: null },
    totalContribution: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    status: { type: String, enum: ["Credited", "Manual", "Payroll"], default: "Credited" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "pf_contribution",
  }
);

// One contribution per employee per month, per tenant.
pfContributionSchema.index({ adminId: 1, merchantId: 1, employeeId: 1, month: 1 }, { unique: true });

export const PFContributionModel: Model<IPFContributionModel> = model<IPFContributionModel>(
  "PFContribution",
  pfContributionSchema
);
