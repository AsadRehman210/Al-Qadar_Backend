import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IJournalLine {
  accountId: mongoose.Types.ObjectId;
  debit: number;
  credit: number;
}

export interface IJournalEntryModel extends Document {
  journalNo?: string | null;
  date?: Date | null;
  memo?: string | null;
  status?: "Draft" | "Posted" | null;
  lines?: IJournalLine[];
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Lines are embedded — a journal entry is always read/written as a whole
// with its lines, never queried independently of its header.
const journalLineSchema = new Schema<IJournalLine>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
  },
  { _id: false }
);

const journalEntrySchema: Schema<IJournalEntryModel> = new Schema(
  {
    journalNo: { type: String, required: true },
    date: { type: Date, required: true },
    memo: { type: String, required: false },
    status: { type: String, enum: ["Draft", "Posted"], default: "Draft" },
    lines: { type: [journalLineSchema], default: [] },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "journal_entry",
  }
);

// Serves journal-service.ts's getAll list (tenant-scoped, sorted _id:-1).
journalEntrySchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const JournalEntryModel: Model<IJournalEntryModel> = model<IJournalEntryModel>(
  "JournalEntry",
  journalEntrySchema
);
