import {
  AppliedVia,
  ApprovalStatus,
  PaymentStatus,
  PaymentMethod,
  IManagerApproval,
  IApprovalHistoryEntry,
  IPaymentHistoryEntry,
} from "../../../model/expense/expense-model";

export interface expenseDto {
  id: string;
  expenseNumber?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  expenseType?: string | null;
  expenseDate?: Date | null;
  amount?: number | null;
  currency?: string | null;
  paymentMethod?: PaymentMethod | null;
  description?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  appliedVia?: AppliedVia | null;
  managerApproval?: IManagerApproval | null;
  approvalStatus?: ApprovalStatus | null;
  paymentStatus?: PaymentStatus | null;
  approvalHistory?: IApprovalHistoryEntry[];
  paymentHistory?: IPaymentHistoryEntry[];
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
