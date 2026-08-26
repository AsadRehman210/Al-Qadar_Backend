import mongoose, { Document, Schema, Model, model } from "mongoose";

export type ApplicableGender = "all" | "male" | "female";

export interface ILeaveTypeModel extends Document {
  name?: string | null;
  daysPerYear?: number | null;
  carryForward?: number | null;
  paid?: boolean | null;
  requiresDocument?: boolean | null;
  minNoticeDays?: number | null;
  maxDaysAtOnce?: number | null;
  applicableGender?: ApplicableGender | null;
  status?: "Active" | "Inactive" | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const leaveTypeSchema: Schema<ILeaveTypeModel> = new Schema(
  {
    name: { type: String, required: true },
    daysPerYear: { type: Number, required: true, default: 0 },
    carryForward: { type: Number, default: 0 },
    paid: { type: Boolean, default: true },
    requiresDocument: { type: Boolean, default: false },
    minNoticeDays: { type: Number, default: 0 },
    maxDaysAtOnce: { type: Number, default: 0 },
    applicableGender: { type: String, enum: ["all", "male", "female"], default: "all" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "leave_type",
  }
);

// Serves leave-type-service.ts's getAll list (tenant-scoped, sorted _id:-1).
leaveTypeSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const LeaveTypeModel: Model<ILeaveTypeModel> = model<ILeaveTypeModel>("LeaveType", leaveTypeSchema);
