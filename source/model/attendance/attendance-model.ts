import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AttendanceStatus = "Present" | "Absent" | "Leave" | "Holiday" | "Half-day";
export type AttendanceShiftType = "Day" | "Night" | "Flexible";

export interface IAttendanceModel extends Document {
  employeeId?: mongoose.Types.ObjectId | null;
  date?: Date | null;
  status?: AttendanceStatus | null;
  checkIn?: string | null;
  checkOut?: string | null;
  shiftType?: AttendanceShiftType | null;
  overtimeHours?: number | null;
  lateMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  notes?: string | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const attendanceSchema: Schema<IAttendanceModel> = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Present", "Absent", "Leave", "Holiday", "Half-day"],
      required: true,
    },
    checkIn: { type: String, default: null },
    checkOut: { type: String, default: null },
    shiftType: { type: String, enum: ["Day", "Night", "Flexible"], default: null },
    overtimeHours: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    earlyLeaveMinutes: { type: Number, default: 0 },
    notes: { type: String, required: false },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "attendance",
  }
);

// One record per employee per day per tenant — marking again upserts instead
// of duplicating (see attendance-service.ts).
attendanceSchema.index({ adminId: 1, merchantId: 1, employeeId: 1, date: 1 }, { unique: true });

export const AttendanceModel: Model<IAttendanceModel> = model<IAttendanceModel>(
  "Attendance",
  attendanceSchema
);
