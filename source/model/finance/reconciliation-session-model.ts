import mongoose, { Document, Schema, Model, model } from "mongoose";

export type ReconciliationSessionStatus = "Open" | "Reconciled";

// One reconciliation period for one bank account — tracks what the bank
// statement says the ending balance was so it can be compared against the
// account's real ledger closing balance for the same period.
export interface IReconciliationSessionModel extends Document {
  bankAccountId?: mongoose.Types.ObjectId | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  statementEndingBalance?: number | null;
  status?: ReconciliationSessionStatus | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const reconciliationSessionSchema: Schema<IReconciliationSessionModel> = new Schema(
  {
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    statementEndingBalance: { type: Number, required: true },
    status: { type: String, enum: ["Open", "Reconciled"], default: "Open" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "reconciliation_session",
  }
);

// Serves reconciliation-session-service.ts's getAll list (tenant-scoped, sorted _id:-1).
reconciliationSessionSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const ReconciliationSessionModel: Model<IReconciliationSessionModel> = model<IReconciliationSessionModel>(
  "ReconciliationSession",
  reconciliationSessionSchema
);
