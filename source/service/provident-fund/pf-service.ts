import mongoose from "mongoose";
import { PFAccountModel, IPFAccountModel } from "../../model/provident-fund/pf-account-model";
import { PFContributionModel } from "../../model/provident-fund/pf-contribution-model";
import { PFWithdrawalModel, IPFWithdrawalModel } from "../../model/provident-fund/pf-withdrawal-model";
import { PFPolicyModel } from "../../model/provident-fund/pf-policy-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { pfAccountDto } from "../../utility/dtos/provident-fund/pf-account-dto";
import { pfContributionDto } from "../../utility/dtos/provident-fund/pf-contribution-dto";
import { pfWithdrawalDto } from "../../utility/dtos/provident-fund/pf-withdrawal-dto";
import { mapDbToDto as mapAccountToDto, mapDbListToDtoList as mapAccountListToDtoList } from "../../utility/mapper/provident-fund/pf-account-mapper";
import { mapDbToDto as mapContributionToDto, mapDbListToDtoList as mapContributionListToDtoList } from "../../utility/mapper/provident-fund/pf-contribution-mapper";
import { mapDbToDto as mapWithdrawalToDto, mapDbListToDtoList as mapWithdrawalListToDtoList } from "../../utility/mapper/provident-fund/pf-withdrawal-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { TenantScope, toAggregateFilter } from "../../utility/helper/tenant-scope";
import { postAutoJournal } from "../finance/journal-service";
import { getCurrent as getCurrentSalary } from "../salary/salary-service";

interface PostContributionInput {
  employeeId: string;
  month: string;
  basic?: number;
}

interface ApplyWithdrawalInput {
  employeeId: string;
  amount: number;
  reason?: string;
  type: "Partial" | "Full";
}

type PFErrorCode =
  | "success"
  | "not_found"
  | "invalid_employee"
  | "policy_not_found"
  | "duplicate_contribution"
  | "no_current_salary"
  | "account_not_found"
  | "insufficient_balance"
  | "invalid_status";

interface PFResult<T> {
  errorCode: PFErrorCode;
  result: T | null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const inTenant = (scope: TenantScope) => ({ adminId: scope.adminId, merchantId: scope.merchantId });

const employeeExists = async (employeeId: string, scope: TenantScope): Promise<boolean> => {
  const employee = await EmployeeModel.findOne({ _id: employeeId, ...inTenant(scope), isDeleted: { $ne: true } }).select("_id").lean();
  return Boolean(employee);
};

const tenantOfDoc = (doc: { adminId?: mongoose.Types.ObjectId | null; merchantId?: mongoose.Types.ObjectId | null }): TenantScope => ({
  adminId: doc.adminId ? String(doc.adminId) : null,
  merchantId: doc.merchantId ? String(doc.merchantId) : null,
});

const generatePfAccountNo = async (scope: TenantScope): Promise<string> => {
  const count = await PFAccountModel.countDocuments(inTenant(scope));
  return `PF-${String(count + 1).padStart(4, "0")}`;
};

// Never created directly by the client — found or lazily created the first
// time a contribution is posted for that employee.
const findOrCreateAccount = async (
  employeeId: string,
  scope: TenantScope,
  createdBy: string
): Promise<IPFAccountModel> => {
  const existing = await PFAccountModel.findOne({ employeeId, ...inTenant(scope) });
  if (existing) return existing;

  const pfAccountNo = await generatePfAccountNo(scope);
  return PFAccountModel.create({
    employeeId,
    pfAccountNo,
    currentBalance: 0,
    totalEmployeeContrib: 0,
    totalEmployerContrib: 0,
    totalWithdrawn: 0,
    status: "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
};

const postContribution = async (
  data: PostContributionInput,
  scope: TenantScope,
  actorId: string
): Promise<PFResult<pfContributionDto>> => {
  if (!(await employeeExists(data.employeeId, scope))) {
    return { errorCode: "invalid_employee", result: null };
  }

  const policy = await PFPolicyModel.findOne(inTenant(scope)).lean();
  if (!policy) {
    return { errorCode: "policy_not_found", result: null };
  }

  const existingContribution = await PFContributionModel.findOne({
    employeeId: data.employeeId,
    month: data.month,
    ...inTenant(scope),
  }).lean();
  if (existingContribution) {
    return { errorCode: "duplicate_contribution", result: null };
  }

  let basic = data.basic;
  if (basic === undefined || basic === null) {
    const currentSalary = await getCurrentSalary(data.employeeId, inTenant(scope));
    if (!currentSalary || !currentSalary.basic_salary) {
      return { errorCode: "no_current_salary", result: null };
    }
    basic = currentSalary.basic_salary;
  }

  const employeeContribution = round2((basic * (policy.employeeRate || 0)) / 100);
  const employerContribution = round2((basic * (policy.employerRate || 0)) / 100);
  const totalContribution = round2(employeeContribution + employerContribution);

  const account = await findOrCreateAccount(data.employeeId, scope, actorId);
  const newBalance = round2((account.currentBalance || 0) + totalContribution);

  account.currentBalance = newBalance;
  account.totalEmployeeContrib = round2((account.totalEmployeeContrib || 0) + employeeContribution);
  account.totalEmployerContrib = round2((account.totalEmployerContrib || 0) + employerContribution);
  await account.save();

  const contribution = await PFContributionModel.create({
    employeeId: data.employeeId,
    month: data.month,
    basic,
    employeeContribution,
    employerContribution,
    totalContribution,
    balanceAfter: newBalance,
    status: "Credited",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy: actorId,
  });

  // Only the employer's share is a fresh cash-facing movement for the
  // business — the employee's share is already reflected as a payroll
  // deduction in Salary.net_salary, not a new expense here.
  await postAutoJournal({
    tenant: scope,
    createdBy: actorId,
    date: new Date(),
    debitAccountCode: "5100",
    creditAccountCode: "2100",
    amount: employerContribution,
    ref: `${account.pfAccountNo}-${data.month}`,
    source: "Provident Fund Contribution",
  });

  return { errorCode: "success", result: mapContributionToDto(contribution) };
};

// Called once per employee when a Payroll Run is marked Paid — posts the
// contribution using the amounts the run itself already computed (basic,
// pfEmployee, pfEmployer — see payroll-run-service.computeLine), never a
// fresh policy-rate calculation, so this always matches what payroll
// actually paid out that month. Silently skips an employee/month that
// already has a contribution (e.g. the run is re-marked paid, or someone
// already posted it manually) rather than erroring the whole run.
const postContributionFromPayroll = async (
  employeeId: string,
  month: string,
  basic: number,
  employeeContribution: number,
  employerContribution: number,
  employeePfPercentage: number,
  employerMultiplier: number,
  scope: TenantScope,
  actorId: string
): Promise<void> => {
  const existingContribution = await PFContributionModel.findOne({ employeeId, month, ...inTenant(scope) }).lean();
  if (existingContribution) return;

  const totalContribution = round2(employeeContribution + employerContribution);
  const account = await findOrCreateAccount(employeeId, scope, actorId);
  const newBalance = round2((account.currentBalance || 0) + totalContribution);

  account.currentBalance = newBalance;
  account.totalEmployeeContrib = round2((account.totalEmployeeContrib || 0) + employeeContribution);
  account.totalEmployerContrib = round2((account.totalEmployerContrib || 0) + employerContribution);
  await account.save();

  await PFContributionModel.create({
    employeeId,
    month,
    basic,
    employeeContribution,
    employerContribution,
    employeePfPercentage,
    employerMultiplier,
    totalContribution,
    balanceAfter: newBalance,
    status: "Payroll",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy: actorId,
  });
};

const applyWithdrawal = async (
  data: ApplyWithdrawalInput,
  scope: TenantScope,
  createdBy: string
): Promise<PFResult<pfWithdrawalDto>> => {
  if (!(await employeeExists(data.employeeId, scope))) {
    return { errorCode: "invalid_employee", result: null };
  }

  const account = await PFAccountModel.findOne({ employeeId: data.employeeId, ...inTenant(scope) }).lean();
  if (!account) {
    return { errorCode: "account_not_found", result: null };
  }

  const balance = account.currentBalance || 0;
  if (data.amount <= 0 || data.amount > balance) {
    return { errorCode: "insufficient_balance", result: null };
  }
  if (data.type === "Full" && data.amount !== balance) {
    return { errorCode: "insufficient_balance", result: null };
  }

  const withdrawal = await PFWithdrawalModel.create({
    employeeId: data.employeeId,
    amount: data.amount,
    reason: data.reason || null,
    type: data.type,
    status: "Pending",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapWithdrawalToDto(withdrawal) };
};

const findWithdrawal = async (id: string, filter: Record<string, unknown>): Promise<IPFWithdrawalModel | null> => {
  return PFWithdrawalModel.findOne({ _id: id, ...filter });
};

const approveWithdrawal = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string
): Promise<PFResult<pfWithdrawalDto>> => {
  const withdrawal = await findWithdrawal(id, filter);
  if (!withdrawal) return { errorCode: "not_found", result: null };
  if (withdrawal.status !== "Pending") return { errorCode: "invalid_status", result: null };

  withdrawal.status = "Approved";
  withdrawal.approvedBy = new mongoose.Types.ObjectId(approverId);
  withdrawal.approvedOn = new Date();
  await withdrawal.save();
  return { errorCode: "success", result: mapWithdrawalToDto(withdrawal) };
};

const rejectWithdrawal = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  remarks?: string
): Promise<PFResult<pfWithdrawalDto>> => {
  const withdrawal = await findWithdrawal(id, filter);
  if (!withdrawal) return { errorCode: "not_found", result: null };
  if (withdrawal.status !== "Pending") return { errorCode: "invalid_status", result: null };

  withdrawal.status = "Rejected";
  withdrawal.approvedBy = new mongoose.Types.ObjectId(approverId);
  withdrawal.approvedOn = new Date();
  withdrawal.remarks = remarks || null;
  await withdrawal.save();
  return { errorCode: "success", result: mapWithdrawalToDto(withdrawal) };
};

const markWithdrawalPaid = async (
  id: string,
  filter: Record<string, unknown>,
  actorId: string
): Promise<PFResult<pfWithdrawalDto>> => {
  const withdrawal = await findWithdrawal(id, filter);
  if (!withdrawal) return { errorCode: "not_found", result: null };
  if (withdrawal.status !== "Approved") return { errorCode: "invalid_status", result: null };

  const account = await PFAccountModel.findOne({
    employeeId: withdrawal.employeeId,
    adminId: withdrawal.adminId,
    merchantId: withdrawal.merchantId,
  });
  if (!account) return { errorCode: "account_not_found", result: null };

  const amount = withdrawal.amount || 0;
  account.currentBalance = round2((account.currentBalance || 0) - amount);
  account.totalWithdrawn = round2((account.totalWithdrawn || 0) + amount);
  await account.save();

  withdrawal.status = "Paid";
  withdrawal.paidOn = new Date();
  await withdrawal.save();

  await postAutoJournal({
    tenant: tenantOfDoc(withdrawal),
    createdBy: actorId,
    date: new Date(),
    debitAccountCode: "2100",
    creditAccountCode: "1010",
    amount,
    ref: account.pfAccountNo || "",
    source: "Provident Fund Withdrawal",
  });

  return { errorCode: "success", result: mapWithdrawalToDto(withdrawal) };
};

const getAccountByEmployee = async (
  employeeId: string,
  filter: Record<string, unknown>
): Promise<pfAccountDto | null> => {
  const account = await PFAccountModel.findOne({ employeeId, ...filter }).lean();
  return account ? mapAccountToDto(account) : null;
};

// Bulk list for the tenant — lets the frontend load every employee's PF
// account in one call instead of one request per employee (the module's
// list page previously had no choice but to N+1 this).
const getAllAccounts = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: { search?: string; status?: string } = {}
): Promise<{ totalCount: number; result: pfAccountDto[] }> => {
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["pfAccountNo"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status" }),
  };
  const startIndex = (page - 1) * limit;
  const data = await PFAccountModel.find(query)
    .populate("employeeId", "first_name last_name employeeCode")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await PFAccountModel.countDocuments(query);
  return { totalCount: count, result: mapAccountListToDtoList(data) };
};

interface PfAccountsSummary {
  totalFund: number;
  totalEmployeeContrib: number;
  totalEmployerContrib: number;
  totalWithdrawn: number;
}

// Tenant-wide totals across every PF account (not just the current page) —
// used for the list page's summary stat cards, which must reflect the
// whole tenant regardless of pagination/search/status filters.
const getAccountsSummary = async (filter: Record<string, unknown>): Promise<PfAccountsSummary> => {
  const [agg] = await PFAccountModel.aggregate([
    { $match: toAggregateFilter(filter) },
    {
      $group: {
        _id: null,
        totalFund: { $sum: "$currentBalance" },
        totalEmployeeContrib: { $sum: "$totalEmployeeContrib" },
        totalEmployerContrib: { $sum: "$totalEmployerContrib" },
        totalWithdrawn: { $sum: "$totalWithdrawn" },
      },
    },
  ]);

  return {
    totalFund: agg?.totalFund || 0,
    totalEmployeeContrib: agg?.totalEmployeeContrib || 0,
    totalEmployerContrib: agg?.totalEmployerContrib || 0,
    totalWithdrawn: agg?.totalWithdrawn || 0,
  };
};

const getContributionHistory = async (
  employeeId: string,
  filter: Record<string, unknown>
): Promise<pfContributionDto[]> => {
  const data = await PFContributionModel.find({ employeeId, ...filter }).sort({ month: -1 }).lean();
  return mapContributionListToDtoList(data);
};

const getWithdrawals = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: pfWithdrawalDto[] }> => {
  const startIndex = (page - 1) * limit;
  const data = await PFWithdrawalModel.find(filter).skip(startIndex).limit(limit).sort({ _id: -1 }).lean();
  const count = await PFWithdrawalModel.countDocuments(filter);
  return { totalCount: count, result: mapWithdrawalListToDtoList(data) };
};

const getWithdrawal = async (id: string, filter: Record<string, unknown>): Promise<pfWithdrawalDto | null> => {
  const data = await findWithdrawal(id, filter);
  return data ? mapWithdrawalToDto(data) : null;
};

const getWithdrawalsByEmployee = async (
  employeeId: string,
  filter: Record<string, unknown>
): Promise<pfWithdrawalDto[]> => {
  const data = await PFWithdrawalModel.find({ employeeId, ...filter }).sort({ _id: -1 }).lean();
  return mapWithdrawalListToDtoList(data);
};

export {
  postContribution,
  postContributionFromPayroll,
  applyWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
  getAccountByEmployee,
  getAllAccounts,
  getAccountsSummary,
  getContributionHistory,
  getWithdrawals,
  getWithdrawal,
  getWithdrawalsByEmployee,
};
