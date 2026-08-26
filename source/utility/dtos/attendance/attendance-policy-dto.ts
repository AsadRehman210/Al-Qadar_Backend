import { IAttendancePolicyRules } from "../../../model/attendance/attendance-policy-model";

export interface attendancePolicyDto {
  id: string;
  name?: string | null;
  implementedDate?: Date | null;
  endDate?: Date | null;
  salaryCalculationDays?: number | null;
  notes?: string | null;
  rules?: IAttendancePolicyRules | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
