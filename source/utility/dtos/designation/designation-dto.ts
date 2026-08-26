export interface designationDto {
  id: string;
  title?: string | null;
  code?: string | null;
  shortName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  level?: string | null;
  grade?: string | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  overtimeRate?: number | null;
  currency?: string | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
