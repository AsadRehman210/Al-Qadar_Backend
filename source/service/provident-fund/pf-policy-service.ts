import { PFPolicyModel, IPFPolicyHistoryEntry } from "../../model/provident-fund/pf-policy-model";
import { pfPolicyDto } from "../../utility/dtos/provident-fund/pf-policy-dto";
import { mapDbToDto } from "../../utility/mapper/provident-fund/pf-policy-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";

interface UpsertPolicyInput {
  employeeRate: number;
  employerRate: number;
  employerContributionMultiplier?: number;
  minServiceMonths?: number;
  vestingYears?: number;
  interestRate?: number;
}

const SNAPSHOT_KEYS = [
  "employeeRate",
  "employerRate",
  "employerContributionMultiplier",
  "minServiceMonths",
  "vestingYears",
  "interestRate",
] as const;

// One policy per tenant — findOneAndUpdate+upsert is the natural atomic
// "create if missing, else update the existing one" operation here, so a
// separate duplicate-guard (like account-model.ts's Super Admin pre-save
// hook) isn't needed.
const upsertPolicy = async (
  data: UpsertPolicyInput,
  scope: TenantScope,
  createdBy: string
): Promise<pfPolicyDto> => {
  const existing = await PFPolicyModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId }).lean();

  const newValues = {
    employeeRate: data.employeeRate,
    employerRate: data.employerRate,
    employerContributionMultiplier: data.employerContributionMultiplier ?? 1,
    minServiceMonths: data.minServiceMonths ?? 0,
    vestingYears: data.vestingYears ?? 0,
    interestRate: data.interestRate ?? 0,
  };

  const updateData: Record<string, unknown> = {
    ...newValues,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  };

  // Only archive a "previous" entry when something actually changed — a
  // no-op save (re-submitting the same values) shouldn't grow the history.
  // Already-computed payroll lines/contributions store their own
  // pfPercentage/pfEmployerMultiplier at compute time, so a later policy
  // change here never touches them.
  if (existing) {
    const changed = SNAPSHOT_KEYS.some((key) => (existing[key] ?? null) !== (newValues[key] ?? null));
    if (changed) {
      const history: IPFPolicyHistoryEntry[] = existing.policyHistory ? [...existing.policyHistory] : [];
      history.push({
        employeeRate: existing.employeeRate ?? null,
        employerRate: existing.employerRate ?? null,
        employerContributionMultiplier: existing.employerContributionMultiplier ?? null,
        minServiceMonths: existing.minServiceMonths ?? null,
        vestingYears: existing.vestingYears ?? null,
        interestRate: existing.interestRate ?? null,
        effectiveFrom: existing.updatedAt || existing.createdAt || new Date(0),
      });
      updateData.policyHistory = history;
    }
  }

  const policy = await PFPolicyModel.findOneAndUpdate(
    { adminId: scope.adminId, merchantId: scope.merchantId },
    { $set: updateData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return mapDbToDto(policy);
};

const getPolicy = async (scope: TenantScope): Promise<pfPolicyDto | null> => {
  const policy = await PFPolicyModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId }).lean();
  return policy ? mapDbToDto(policy) : null;
};

export { upsertPolicy, getPolicy };
