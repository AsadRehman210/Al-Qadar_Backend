export interface leaveTypeDto {
  id: string;
  name?: string | null;
  daysPerYear?: number | null;
  carryForward?: number | null;
  paid?: boolean | null;
  requiresDocument?: boolean | null;
  minNoticeDays?: number | null;
  maxDaysAtOnce?: number | null;
  applicableGender?: string | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
