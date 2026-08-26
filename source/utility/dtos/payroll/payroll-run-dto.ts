export interface payrollLineDto {
  employeeId?: string | null;
  basic?: number | null;
  hra?: number | null;
  medical?: number | null;
  transport?: number | null;
  food?: number | null;
  mobile?: number | null;
  overtimeHours?: number | null;
  overtimeRate?: number | null;
  overtime?: number | null;
  bonus?: number | null;
  arrears?: number | null;
  grossEarnings?: number | null;
  pfEmployee?: number | null;
  pfEmployer?: number | null;
  pfPercentage?: number | null;
  pfEmployerMultiplier?: number | null;
  incomeTax?: number | null;
  insurance?: number | null;
  loanDeduction?: number | null;
  advance?: number | null;
  attendanceDeduction?: number | null;
  otherDeductions?: number | null;
  totalDeductions?: number | null;
  netPay?: number | null;
  employerCost?: number | null;
  paymentStatus?: string | null;
  paymentDate?: Date | null;
  paymentRef?: string | null;
}

// One employee's line across a single run — the shape the Employee Detail
// page's Month-wise Salary tab consumes (one row per real payroll run that
// actually included this employee, with the run's own status/month).
export interface payrollEmployeeHistoryDto {
  runId: string;
  runNumber?: string | null;
  month?: string | null;
  runStatus?: string | null;
  line: payrollLineDto;
}

export interface payrollRunDto {
  id: string;
  runNumber?: string | null;
  month?: string | null;
  status?: string | null;
  employees?: payrollLineDto[];
  totalGross?: number | null;
  totalDeductions?: number | null;
  totalNet?: number | null;
  totalEmployerCost?: number | null;
  notes?: string | null;
  approvedBy?: string | null;
  approvedOn?: Date | null;
  processedOn?: Date | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
