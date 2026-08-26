export interface pfAccountDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  pfAccountNo?: string | null;
  currentBalance?: number | null;
  totalEmployeeContrib?: number | null;
  totalEmployerContrib?: number | null;
  totalWithdrawn?: number | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
