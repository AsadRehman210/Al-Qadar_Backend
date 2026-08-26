export interface leaveApprovalStepDto {
  status?: string | null;
  approvedBy?: string | null;
  approvedOn?: Date | null;
  comments?: string | null;
}

export interface leaveDto {
  id: string;
  leaveNumber?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  leaveTypeId?: string | null;
  leaveTypeName?: string | null;
  fromDate?: Date | null;
  toDate?: Date | null;
  days?: number | null;
  halfDay?: string | null;
  reason?: string | null;
  handoverToEmployeeId?: string | null;
  emergencyContact?: string | null;
  attachments?: { name?: string | null; url?: string | null }[];
  appliedVia?: string | null;
  status?: string | null;
  appliedAt?: Date | null;
  managerApproval?: leaveApprovalStepDto | null;
  hrApproval?: leaveApprovalStepDto | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
