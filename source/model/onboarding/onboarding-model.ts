import mongoose, { Document, Schema, Model, model } from "mongoose";
import { OnboardingTaskCategory } from "./onboarding-template-model";

export type OnboardingStatus = "In Progress" | "Completed";

export interface IOnboardingTask {
  templateId?: mongoose.Types.ObjectId | null;
  label?: string | null;
  category?: OnboardingTaskCategory | null;
  required?: boolean | null;
  done?: boolean | null;
  doneAt?: Date | null;
}

export interface IOnboardingModel extends Document {
  employeeId?: mongoose.Types.ObjectId | null;
  candidateId?: mongoose.Types.ObjectId | null;
  jobId?: mongoose.Types.ObjectId | null;
  joiningDate?: Date | null;
  tasks?: IOnboardingTask[];
  status?: OnboardingStatus | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const onboardingTaskSchema = new Schema<IOnboardingTask>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: "OnboardingTemplate", default: null },
    label: { type: String, required: true },
    category: {
      type: String,
      enum: ["documentation", "it_access", "workplace", "payroll", "orientation"],
      default: "documentation",
    },
    required: { type: Boolean, default: false },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { _id: false }
);

const onboardingSchema: Schema<IOnboardingModel> = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "Candidate", default: null },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", default: null },
    joiningDate: { type: Date, required: false },
    tasks: { type: [onboardingTaskSchema], default: [] },
    status: { type: String, enum: ["In Progress", "Completed"], default: "In Progress" },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "onboarding",
  }
);

// Serves onboarding-service.ts's getAll list (tenant-scoped, sorted _id:-1).
onboardingSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const OnboardingModel: Model<IOnboardingModel> = model<IOnboardingModel>("Onboarding", onboardingSchema);
