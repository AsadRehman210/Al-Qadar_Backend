import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface ILedgerLineModel extends Document {
  date?: Date | null;
  accountId?: mongoose.Types.ObjectId | null;
  debit?: number | null;
  credit?: number | null;
  ref?: string | null;
  source?: string | null;
  currency?: string | null;
  journalEntryId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// The flattened, queryable posting record — every JournalEntry.lines write
// fans out into one LedgerLine per line, so account balances/history can be
// queried directly without unwinding journal entries every time.
const ledgerLineSchema: Schema<ILedgerLineModel> = new Schema(
  {
    date: { type: Date, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    ref: { type: String, required: false },
    source: { type: String, required: false },
    currency: { type: String, default: "SAR" },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "ledger_line",
  }
);

// Serves ledger-service.ts's getAll list (tenant-scoped, optionally accountId-filtered, sorted date:-1,_id:-1).
ledgerLineSchema.index({ adminId: 1, merchantId: 1, date: -1, _id: -1 });
// Serves ledger-service.ts's getByAccount (tenant + accountId, sorted date:1,_id:1 for running-balance walk).
ledgerLineSchema.index({ adminId: 1, merchantId: 1, accountId: 1, date: 1, _id: 1 });

export const LedgerLineModel: Model<ILedgerLineModel> = model<ILedgerLineModel>(
  "LedgerLine",
  ledgerLineSchema
);
