export interface pfContributionDto {
  id: string;
  employeeId?: string | null;
  month?: string | null;
  basic?: number | null;
  employeeContribution?: number | null;
  employerContribution?: number | null;
  employeePfPercentage?: number | null;
  employerMultiplier?: number | null;
  totalContribution?: number | null;
  balanceAfter?: number | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
