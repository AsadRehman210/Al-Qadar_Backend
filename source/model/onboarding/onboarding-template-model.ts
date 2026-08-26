import mongoose, { Document, Schema, Model, model } from "mongoose";

export type OnboardingTaskCategory = "documentation" | "it_access" | "workplace" | "payroll" | "orientation";

export interface IOnboardingTemplateModel extends Document {
  label?: string | null;
  category?: OnboardingTaskCategory | null;
  required?: boolean | null;
  active?: boolean | null;
  order?: number | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const onboardingTemplateSchema: Schema<IOnboardingTemplateModel> = new Schema(
  {
    label: { type: String, required: true },
    category: {
      type: String,
      enum: ["documentation", "it_access", "workplace", "payroll", "orientation"],
      default: "documentation",
    },
    required: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "onboarding_template",
  }
);

// Serves onboarding-template-service.ts's getAll/getActive lists (tenant-scoped, sorted order:1).
onboardingTemplateSchema.index({ adminId: 1, merchantId: 1, order: 1 });

export const OnboardingTemplateModel: Model<IOnboardingTemplateModel> = model<IOnboardingTemplateModel>(
  "OnboardingTemplate",
  onboardingTemplateSchema
);
