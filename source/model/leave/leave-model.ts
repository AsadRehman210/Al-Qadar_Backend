import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AppliedVia = "employee" | "hr";
export type LeaveApprovalStepStatus = "Pending" | "Approved" | "Rejected" | "Skipped";
export type LeaveStatus = "Pending Manager" | "Pending HR" | "Approved" | "Rejected" | "Cancelled";
export type HalfDay = "full" | "first_half" | "second_half";

export interface ILeaveApprovalStep {
  status?: LeaveApprovalStepStatus | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedOn?: Date | null;
  comments?: string | null;
}

const leaveApprovalStepSchema = new Schema<ILeaveApprovalStep>(
  {
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Skipped"], default: "Pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    approvedOn: { type: Date, default: null },
    comments: { type: String, default: null },
  },
  { _id: false }
);

export interface ILeaveModel extends Document {
  leaveNumber?: string | null;
  employeeId?: mongoose.Types.ObjectId | null;
  leaveTypeId?: mongoose.Types.ObjectId | null;
  fromDate?: Date | null;
  toDate?: Date | null;
  days?: number | null;
  halfDay?: HalfDay | null;
  reason?: string | null;
  handoverToEmployeeId?: mongoose.Types.ObjectId | null;
  emergencyContact?: string | null;
  attachments?: { name?: string | null; url?: string | null }[];
  appliedVia?: AppliedVia | null;
  status?: LeaveStatus | null;
  appliedAt?: Date | null;
  managerApproval?: ILeaveApprovalStep | null;
  hrApproval?: ILeaveApprovalStep | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const attachmentSchema = new Schema(
  { name: { type: String, default: null }, url: { type: String, default: null } },
  { _id: false }
);

const leaveSchema: Schema<ILeaveModel> = new Schema(
  {
    leaveNumber: { type: String, required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: "LeaveType", required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    days: { type: Number, required: true },
    halfDay: { type: String, enum: ["full", "first_half", "second_half"], default: "full" },
    reason: { type: String, default: null },
    handoverToEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    emergencyContact: { type: String, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    appliedVia: { type: String, enum: ["employee", "hr"], required: true },
    status: {
      type: String,
      enum: ["Pending Manager", "Pending HR", "Approved", "Rejected", "Cancelled"],
      required: true,
    },
    appliedAt: { type: Date, default: () => new Date() },
    managerApproval: { type: leaveApprovalStepSchema, default: () => ({}) },
    hrApproval: { type: leaveApprovalStepSchema, default: () => ({}) },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "leave",
  }
);

leaveSchema.index({ adminId: 1, merchantId: 1, leaveNumber: 1 }, { unique: true });

// Serves leave-service.ts's getAll list (tenant-scoped, sorted _id:-1).
leaveSchema.index({ adminId: 1, merchantId: 1, _id: -1 });
// Serves leave-service.ts's getByEmployee (employeeId, sorted _id:-1).
leaveSchema.index({ employeeId: 1, _id: -1 });

export const LeaveModel: Model<ILeaveModel> = model<ILeaveModel>("Leave", leaveSchema);
