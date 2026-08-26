import mongoose, { Document, Schema, Model, model } from "mongoose";

export type CandidateStage = "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";

export interface ICandidateModel extends Document {
  jobId?: mongoose.Types.ObjectId | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  experience?: string | null;
  currentCompany?: string | null;
  stage?: CandidateStage | null;
  notes?: string | null;
  interviewDate?: Date | null;
  rating?: number | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const candidateSchema: Schema<ICandidateModel> = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    name: { type: String, required: true },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    experience: { type: String, default: null },
    currentCompany: { type: String, default: null },
    stage: {
      type: String,
      enum: ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"],
      default: "Applied",
    },
    notes: { type: String, default: null },
    interviewDate: { type: Date, default: null },
    rating: { type: Number, default: null },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "candidate",
  }
);

// Serves candidate-service.ts's getAll list (tenant-scoped, sorted _id:-1).
candidateSchema.index({ adminId: 1, merchantId: 1, _id: -1 });
// Serves candidate-service.ts's getByJob (jobId, sorted _id:-1).
candidateSchema.index({ jobId: 1, _id: -1 });

export const CandidateModel: Model<ICandidateModel> = model<ICandidateModel>("Candidate", candidateSchema);
