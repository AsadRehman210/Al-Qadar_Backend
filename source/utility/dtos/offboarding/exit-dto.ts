import {
  ExitType,
  ExitStatus,
  IClearance,
  ISettlement,
  IExitInterview,
} from "../../../model/offboarding/exit-model";

export interface exitDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  designation?: string | null;
  exitType?: ExitType | null;
  reason?: string | null;
  noticePeriodDays?: number | null;
  resignationDate?: Date | null;
  lastWorkingDay?: Date | null;
  status?: ExitStatus | null;
  clearance?: IClearance | null;
  settlement?: ISettlement | null;
  exitInterview?: IExitInterview | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
