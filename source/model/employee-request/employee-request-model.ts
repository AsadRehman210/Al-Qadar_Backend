import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AppliedVia = "employee" | "hr";
export type ApprovalStageStatus = "Pending" | "Approved" | "Rejected" | "Skipped";
export type RequestStatus =
  | "Pending Manager"
  | "Pending HR"
  | "Approved"
  | "Rejected"
  | "Cancelled";

export interface IApprovalStage {
  status?: ApprovalStageStatus | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedOn?: Date | null;
  comments?: string | null;
}

export interface IEmployeeRequestModel extends Document {
  requestNumber?: string | null;
  type?: string | null;
  employeeId?: mongoose.Types.ObjectId | null;
  managerId?: mongoose.Types.ObjectId | null;
  details?: Record<string, unknown> | null;
  summary?: string | null;
  appliedVia?: AppliedVia | null;
  status?: RequestStatus | null;
  managerApproval?: IApprovalStage | null;
  hrApproval?: IApprovalStage | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const approvalStageSchema = new Schema<IApprovalStage>(
  {
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Skipped"], default: "Pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    approvedOn: { type: Date, default: null },
    comments: { type: String, default: null },
  },
  { _id: false }
);

const employeeRequestSchema: Schema<IEmployeeRequestModel> = new Schema(
  {
    requestNumber: { type: String, required: true },
    type: { type: String, required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    managerId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    details: { type: Schema.Types.Mixed, default: {} },
    summary: { type: String, default: null },
    appliedVia: { type: String, enum: ["employee", "hr"], required: true },
    status: {
      type: String,
      enum: ["Pending Manager", "Pending HR", "Approved", "Rejected", "Cancelled"],
      required: true,
    },
    managerApproval: { type: approvalStageSchema, default: () => ({}) },
    hrApproval: { type: approvalStageSchema, default: () => ({}) },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "employee_request",
  }
);

employeeRequestSchema.index({ adminId: 1, merchantId: 1, requestNumber: 1 }, { unique: true });

// Serves employee-request-service.ts's getAll list (tenant-scoped, sorted _id:-1).
employeeRequestSchema.index({ adminId: 1, merchantId: 1, _id: -1 });
// Serves employee-request-service.ts's getByEmployee (employeeId, sorted _id:-1).
employeeRequestSchema.index({ employeeId: 1, _id: -1 });

export const EmployeeRequestModel: Model<IEmployeeRequestModel> = model<IEmployeeRequestModel>(
  "EmployeeRequest",
  employeeRequestSchema
);
