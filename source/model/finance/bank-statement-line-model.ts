import mongoose, { Document, Schema, Model, model } from "mongoose";

// A line the user entered/imported from the bank's own statement — matched
// by hand against that account's real Ledger lines (see ledger-service's
// getByAccount). Never a source of truth on its own; it exists purely to be
// checked off against what the ledger already says happened.
export interface IBankStatementLineModel extends Document {
  bankAccountId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  description?: string | null;
  amount?: number | null;
  reference?: string | null;
  matched?: boolean | null;
  matchedLedgerLineId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const bankStatementLineSchema: Schema<IBankStatementLineModel> = new Schema(
  {
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true },
    date: { type: Date, required: true },
    description: { type: String, default: null },
    amount: { type: Number, required: true },
    reference: { type: String, default: null },
    matched: { type: Boolean, default: false },
    matchedLedgerLineId: { type: Schema.Types.ObjectId, ref: "LedgerLine", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "bank_statement_line",
  }
);

// Serves bank-statement-line-service.ts's getAll list (tenant-scoped, sorted date:-1,_id:-1).
bankStatementLineSchema.index({ adminId: 1, merchantId: 1, date: -1, _id: -1 });

export const BankStatementLineModel: Model<IBankStatementLineModel> = model<IBankStatementLineModel>(
  "BankStatementLine",
  bankStatementLineSchema
);
