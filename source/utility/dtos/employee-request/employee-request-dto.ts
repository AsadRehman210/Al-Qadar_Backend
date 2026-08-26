import {
  AppliedVia,
  RequestStatus,
  IApprovalStage,
} from "../../../model/employee-request/employee-request-model";

export interface employeeRequestDto {
  id: string;
  requestNumber?: string | null;
  type?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  details?: Record<string, unknown> | null;
  summary?: string | null;
  appliedVia?: AppliedVia | null;
  status?: RequestStatus | null;
  managerApproval?: IApprovalStage | null;
  hrApproval?: IApprovalStage | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
