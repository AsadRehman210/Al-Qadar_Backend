export interface pfWithdrawalDto {
  id: string;
  employeeId?: string | null;
  amount?: number | null;
  reason?: string | null;
  type?: string | null;
  status?: string | null;
  approvedBy?: string | null;
  approvedOn?: Date | null;
  paidOn?: Date | null;
  remarks?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
