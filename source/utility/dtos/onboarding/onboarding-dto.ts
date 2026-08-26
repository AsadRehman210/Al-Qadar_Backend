import { OnboardingStatus, IOnboardingTask } from "../../../model/onboarding/onboarding-model";

export interface onboardingTaskDto {
  templateId?: string | null;
  label?: string | null;
  category?: string | null;
  required?: boolean | null;
  done?: boolean | null;
  doneAt?: Date | null;
}

export interface onboardingDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  position?: string | null;
  candidateId?: string | null;
  jobId?: string | null;
  joiningDate?: Date | null;
  tasks?: IOnboardingTask[];
  status?: OnboardingStatus | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
