import mongoose, { Document, Schema, Model, model } from "mongoose";

export type ChartOfAccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";

export interface IChartOfAccountModel extends Document {
  code?: string | null;
  name?: string | null;
  type?: ChartOfAccountType | null;
  subType?: string | null;
  parentId?: mongoose.Types.ObjectId | null;
  status?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const chartOfAccountSchema: Schema<IChartOfAccountModel> = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["Asset", "Liability", "Equity", "Revenue", "Expense"],
      required: true,
    },
    subType: { type: String, required: false },
    parentId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", default: null },
    status: { type: String, default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "chart_of_account",
  }
);

// A tenant can't have two accounts sharing the same code.
chartOfAccountSchema.index({ adminId: 1, merchantId: 1, code: 1 }, { unique: true });

export const ChartOfAccountModel: Model<IChartOfAccountModel> = model<IChartOfAccountModel>(
  "ChartOfAccount",
  chartOfAccountSchema
);
