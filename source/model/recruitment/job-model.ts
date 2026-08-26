import mongoose, { Document, Schema, Model, model } from "mongoose";

export type JobStatus = "Open" | "On Hold" | "Closed";

export interface IJobModel extends Document {
  jobCode?: string | null;
  title?: string | null;
  departmentId?: mongoose.Types.ObjectId | null;
  designationId?: mongoose.Types.ObjectId | null;
  openings?: number | null;
  status?: JobStatus | null;
  deadline?: Date | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  experience?: string | null;
  description?: string | null;
  requirements?: string | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const jobSchema: Schema<IJobModel> = new Schema(
  {
    jobCode: { type: String, required: true },
    title: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    designationId: { type: Schema.Types.ObjectId, ref: "Designation", required: true },
    openings: { type: Number, default: 1 },
    status: { type: String, enum: ["Open", "On Hold", "Closed"], default: "Open" },
    deadline: { type: Date, required: false },
    salaryMin: { type: Number, default: 0 },
    salaryMax: { type: Number, default: 0 },
    currency: { type: String, default: "SAR" },
    experience: { type: String, default: null },
    description: { type: String, default: null },
    requirements: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "job",
  }
);

jobSchema.index({ adminId: 1, merchantId: 1, jobCode: 1 }, { unique: true });

// Serves job-service.ts's getAll list (tenant-scoped, sorted _id:-1).
jobSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const JobModel: Model<IJobModel> = model<IJobModel>("Job", jobSchema);
