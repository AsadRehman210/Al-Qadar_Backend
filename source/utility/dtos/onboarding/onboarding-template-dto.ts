import { OnboardingTaskCategory } from "../../../model/onboarding/onboarding-template-model";

export interface onboardingTemplateDto {
  id: string;
  label?: string | null;
  category?: OnboardingTaskCategory | null;
  required?: boolean | null;
  active?: boolean | null;
  order?: number | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
