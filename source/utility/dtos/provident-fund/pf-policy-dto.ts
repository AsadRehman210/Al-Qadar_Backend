export interface pfPolicyHistoryEntryDto {
  employeeRate?: number | null;
  employerRate?: number | null;
  employerContributionMultiplier?: number | null;
  minServiceMonths?: number | null;
  vestingYears?: number | null;
  interestRate?: number | null;
  effectiveFrom: Date;
}

export interface pfPolicyDto {
  id: string;
  employeeRate?: number | null;
  employerRate?: number | null;
  employerContributionMultiplier?: number | null;
  minServiceMonths?: number | null;
  vestingYears?: number | null;
  interestRate?: number | null;
  policyHistory?: pfPolicyHistoryEntryDto[];
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
