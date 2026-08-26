import { JobStatus } from "../../../model/recruitment/job-model";

export interface jobDto {
  id: string;
  jobCode?: string | null;
  title?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  designationId?: string | null;
  designationTitle?: string | null;
  candidateCount?: number;
  hiredCount?: number;
  openings?: number | null;
  status?: JobStatus | null;
  deadline?: Date | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  experience?: string | null;
  description?: string | null;
  requirements?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
