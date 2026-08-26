import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IAttendancePolicyRules {
  alwaysPresent?: boolean | null;
  lateGraceMinutes?: number | null;
  earlyGraceMinutes?: number | null;
  deductionPerMinute?: number | null;
  managerApprovalEnabled?: boolean | null;
  managerLateFullDay?: boolean | null;
  managerEarlyFullDay?: boolean | null;
}

export interface IAttendancePolicyModel extends Document {
  name?: string | null;
  implementedDate?: Date | null;
  endDate?: Date | null;
  salaryCalculationDays?: number | null;
  notes?: string | null;
  rules?: IAttendancePolicyRules | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const rulesSchema = new Schema<IAttendancePolicyRules>(
  {
    alwaysPresent: { type: Boolean, default: false },
    lateGraceMinutes: { type: Number, default: 0 },
    earlyGraceMinutes: { type: Number, default: 0 },
    deductionPerMinute: { type: Number, default: 0 },
    managerApprovalEnabled: { type: Boolean, default: false },
    managerLateFullDay: { type: Boolean, default: false },
    managerEarlyFullDay: { type: Boolean, default: false },
  },
  { _id: false }
);

// A list of time-versioned policies, not a singleton — only one per tenant
// ever has endDate: null (current); the rest are closed history, kept
// forever. See attendance-policy-service.ts's create() for the auto-close.
// Days off are no longer configured here — each Employee now has their own
// weekly_schedule (see employee-model.ts), so there is no single company-wide
// shift or weekly-off-days list to store.
const attendancePolicySchema: Schema<IAttendancePolicyModel> = new Schema(
  {
    name: { type: String, required: true },
    implementedDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    salaryCalculationDays: { type: Number, default: 30 },
    notes: { type: String, required: false },
    rules: { type: rulesSchema, default: () => ({}) },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "attendance_policy",
  }
);

// Serves attendance-policy-service.ts's getAll list (tenant-scoped, sorted implementedDate:-1).
attendancePolicySchema.index({ adminId: 1, merchantId: 1, implementedDate: -1 });

export const AttendancePolicyModel: Model<IAttendancePolicyModel> = model<IAttendancePolicyModel>(
  "AttendancePolicy",
  attendancePolicySchema
);
