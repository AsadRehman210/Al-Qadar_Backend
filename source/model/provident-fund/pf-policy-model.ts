import mongoose, { Document, Schema, Model, model } from "mongoose";

// One per tenant — enforced via upsert in pf-policy-service.ts rather than a
// pre-save guard, since "create-or-update the tenant's single policy" is
// exactly what findOneAndUpdate(..., {upsert:true}) already gives us atomically.
export interface IPFPolicySnapshot {
  employeeRate?: number | null;
  employerRate?: number | null;
  employerContributionMultiplier?: number | null;
  minServiceMonths?: number | null;
  vestingYears?: number | null;
  interestRate?: number | null;
}

// A past policy and the date it stopped being current — appended to
// whenever the policy is actually changed, so the settings page can show
// "current" alongside the one right before it (and payroll runs already
// computed under the old values are never touched by a later change).
export interface IPFPolicyHistoryEntry extends IPFPolicySnapshot {
  effectiveFrom: Date;
}

export interface IPFPolicyModel extends Document, IPFPolicySnapshot {
  policyHistory?: IPFPolicyHistoryEntry[];
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const pfPolicyHistorySchema = new Schema<IPFPolicyHistoryEntry>(
  {
    employeeRate: { type: Number },
    employerRate: { type: Number },
    employerContributionMultiplier: { type: Number },
    minServiceMonths: { type: Number },
    vestingYears: { type: Number },
    interestRate: { type: Number },
    effectiveFrom: { type: Date, required: true },
  },
  { _id: false }
);

const pfPolicySchema: Schema<IPFPolicyModel> = new Schema(
  {
    employeeRate: { type: Number, required: true },
    employerRate: { type: Number, required: true },
    employerContributionMultiplier: { type: Number, default: 1 },
    minServiceMonths: { type: Number, default: 0 },
    vestingYears: { type: Number, default: 0 },
    interestRate: { type: Number, default: 0 },
    policyHistory: { type: [pfPolicyHistorySchema], default: [] },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "pf_policy",
  }
);

pfPolicySchema.index({ adminId: 1, merchantId: 1 }, { unique: true });

export const PFPolicyModel: Model<IPFPolicyModel> = model<IPFPolicyModel>("PFPolicy", pfPolicySchema);
