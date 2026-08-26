import { CandidateStage } from "../../../model/recruitment/candidate-model";

export interface candidateDto {
  id: string;
  jobId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  experience?: string | null;
  currentCompany?: string | null;
  stage?: CandidateStage | null;
  notes?: string | null;
  interviewDate?: Date | null;
  rating?: number | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
