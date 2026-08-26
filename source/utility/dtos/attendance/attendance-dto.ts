import { AttendanceStatus, AttendanceShiftType } from "../../../model/attendance/attendance-model";

export interface attendanceDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  date?: Date | null;
  status?: AttendanceStatus | null;
  checkIn?: string | null;
  checkOut?: string | null;
  shiftType?: AttendanceShiftType | null;
  overtimeHours?: number | null;
  lateMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  notes?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
