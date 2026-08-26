import { ISalaryAllowances, ISalaryDeductions, SalaryPaymentStatus } from "../../../model/salary/salary-model";

export interface salaryDto {
  id: string;
  employeeId?: string | null;
  basic_salary?: number | null;
  allowances?: ISalaryAllowances | null;
  deductions?: ISalaryDeductions | null;
  tax_percentage?: number | null;
  pf_percentage?: number | null;
  gross_salary?: number | null;
  net_salary?: number | null;
  bank_name?: string | null;
  branch_name?: string | null;
  branch_code?: string | null;
  account_no?: string | null;
  ifsc?: string | null;
  pf_number?: string | null;
  payment_status?: SalaryPaymentStatus | null;
  payment_date?: Date | null;
  effective_from?: Date | null;
  effective_to?: Date | null;
  salary_notes?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
