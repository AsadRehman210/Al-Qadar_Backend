import mongoose, { Document, Schema, Model, model } from "mongoose";

// One row per account per month — the target set for that Revenue/Expense
// account in that period. getBudgetVsActual (reports-service-adjacent, see
// budget-service.ts) compares this against the same account's real
// ledger_line activity for the same month, same derived-report pattern as
// every other Finance report.
export interface IBudgetModel extends Document {
  accountId: mongoose.Types.ObjectId;
  period?: string | null; // "YYYY-MM"
  budgetAmount?: number | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const budgetSchema: Schema<IBudgetModel> = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
    period: { type: String, required: true },
    budgetAmount: { type: Number, default: 0 },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "budget",
  }
);

// One budget per account per month per tenant — re-setting the same
// account/period is an update (see budget-service.ts's upsert), not a
// duplicate row.
budgetSchema.index({ adminId: 1, merchantId: 1, accountId: 1, period: 1 }, { unique: true });

// Serves budget-service.ts's getAll list (tenant-scoped, optionally year-filtered, sorted period:1) —
// doesn't hit the unique index above since accountId isn't part of this filter.
budgetSchema.index({ adminId: 1, merchantId: 1, period: 1 });

export const BudgetModel: Model<IBudgetModel> = model<IBudgetModel>("Budget", budgetSchema);
