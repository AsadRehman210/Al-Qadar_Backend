import {
  LoanType,
  LoanPurpose,
  AppliedVia,
  LoanStatus,
  IManagerApproval,
  IGuarantor,
  IEmiInstallment,
  ILoanDocument,
} from "../../../model/loan/loan-model";

export interface loanDto {
  id: string;
  loanNumber?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  loanType?: LoanType | null;
  loanPurpose?: LoanPurpose | null;
  loanAmount?: number | null;
  interestPercent?: number | null;
  numberOfInstallments?: number | null;
  monthlyDeduction?: number | null;
  appliedVia?: AppliedVia | null;
  managerApproval?: IManagerApproval | null;
  status?: LoanStatus | null;
  guarantor?: IGuarantor | null;
  emiSchedule?: IEmiInstallment[];
  documents?: ILoanDocument[];
  approvedBy?: string | null;
  approvalDate?: Date | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
  preClosureAmount?: number | null;
  preClosureDate?: Date | null;
  notes?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
