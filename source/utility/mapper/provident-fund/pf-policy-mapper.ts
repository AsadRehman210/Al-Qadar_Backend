import { pfPolicyDto } from "../../dtos/provident-fund/pf-policy-dto";
import { IPFPolicyModel } from "../../../model/provident-fund/pf-policy-model";

const mapDbToDto = (dbModel: IPFPolicyModel): pfPolicyDto => ({
  id: dbModel._id ? String(dbModel._id) : "",
  employeeRate: dbModel.employeeRate ?? null,
  employerRate: dbModel.employerRate ?? null,
  employerContributionMultiplier: dbModel.employerContributionMultiplier ?? 1,
  minServiceMonths: dbModel.minServiceMonths ?? null,
  vestingYears: dbModel.vestingYears ?? null,
  interestRate: dbModel.interestRate ?? null,
  policyHistory: (dbModel.policyHistory || []).map((h) => ({
    employeeRate: h.employeeRate ?? null,
    employerRate: h.employerRate ?? null,
    employerContributionMultiplier: h.employerContributionMultiplier ?? null,
    minServiceMonths: h.minServiceMonths ?? null,
    vestingYears: h.vestingYears ?? null,
    interestRate: h.interestRate ?? null,
    effectiveFrom: h.effectiveFrom,
  })),
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
});

export { mapDbToDto };
