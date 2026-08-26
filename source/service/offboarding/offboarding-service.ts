import mongoose from "mongoose";
import { ExitModel, IExitModel, ClearanceSection, ISettlement } from "../../model/offboarding/exit-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { LoanModel } from "../../model/loan/loan-model";
import { exitDto } from "../../utility/dtos/offboarding/exit-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/offboarding/exit-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import * as employeeService from "../employee/employee-service";
import * as leaveService from "../leave/leave-service";
import * as pfService from "../provident-fund/pf-service";
import * as salaryService from "../salary/salary-service";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface ExitListOptions {
  search?: string;
  status?: string;
  exitType?: string;
  employeeId?: string;
}

interface InitiateExitInput {
  employeeId: string;
  exitType: string;
  reason?: string;
  noticePeriodDays?: number;
  resignationDate?: string;
  lastWorkingDay: string;
}

type ExitErrorCode = "success" | "invalid_employee" | "active_exit_exists" | "not_found" | "invalid_status";

interface ExitResult {
  errorCode: ExitErrorCode;
  result: exitDto | null;
}

const EXIT_TYPE_TO_STATUS: Record<string, string> = {
  Resignation: "resigned",
  Retirement: "retired",
  Termination: "terminated",
  Absconding: "absconding",
  "Contract End": "resigned",
};

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const findExit = async (id: string, filter: Record<string, unknown>): Promise<IExitModel | null> =>
  ExitModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });

const getActiveForEmployee = async (employeeId: string, filter: Record<string, unknown>): Promise<exitDto | null> => {
  const data = await ExitModel.findOne({
    employeeId,
    ...filter,
    isDeleted: { $ne: true },
    status: { $nin: ["Cancelled", "Completed"] },
  }).lean();
  return data ? mapDbToDto(data) : null;
};

const initiateExit = async (
  data: InitiateExitInput,
  scope: TenantScope,
  createdBy: string
): Promise<ExitResult> => {
  const employee = await EmployeeModel.findOne({ _id: data.employeeId, ...inTenant(scope) }).lean();
  if (!employee) return { errorCode: "invalid_employee", result: null };

  const active = await getActiveForEmployee(data.employeeId, inTenant(scope));
  if (active) return { errorCode: "active_exit_exists", result: null };

  const exit = await ExitModel.create({
    employeeId: data.employeeId,
    exitType: data.exitType,
    reason: data.reason || null,
    noticePeriodDays: data.noticePeriodDays || 0,
    resignationDate: data.resignationDate ? new Date(data.resignationDate) : null,
    lastWorkingDay: new Date(data.lastWorkingDay),
    status: "Notice Period",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(exit) };
};

const CLEARANCE_SECTIONS: ClearanceSection[] = ["assets", "finance", "it", "manager"];

const updateClearanceItem = async (
  id: string,
  section: ClearanceSection,
  data: { status: string; notes?: string },
  filter: Record<string, unknown>,
  approverId: string
): Promise<ExitResult> => {
  const exit = await findExit(id, filter);
  if (!exit) return { errorCode: "not_found", result: null };

  const cleared = data.status === "Cleared";
  if (!exit.clearance) exit.clearance = {};
  exit.clearance[section] = {
    status: data.status as "Pending" | "Cleared",
    clearedBy: cleared ? new mongoose.Types.ObjectId(approverId) : null,
    clearedOn: cleared ? new Date() : null,
    notes: data.notes || null,
  };
  exit.markModified("clearance");

  const allCleared = CLEARANCE_SECTIONS.every((s) => exit.clearance?.[s]?.status === "Cleared");
  if (exit.status === "Notice Period" || exit.status === "Clearance") {
    exit.status = allCleared ? "Settlement" : "Clearance";
  }

  await exit.save();
  return { errorCode: "success", result: mapDbToDto(exit) };
};

const saveExitInterview = async (
  id: string,
  data: { reasonCategory?: string; wouldRehire?: boolean; comments?: string },
  filter: Record<string, unknown>,
  submittedBy: string
): Promise<ExitResult> => {
  const exit = await findExit(id, filter);
  if (!exit) return { errorCode: "not_found", result: null };

  exit.exitInterview = {
    reasonCategory: data.reasonCategory || null,
    wouldRehire: data.wouldRehire ?? null,
    comments: data.comments || null,
    submittedBy: new mongoose.Types.ObjectId(submittedBy),
    submittedOn: new Date(),
  };
  exit.markModified("exitInterview");
  await exit.save();
  return { errorCode: "success", result: mapDbToDto(exit) };
};

/**
 * Live full & final settlement preview, sourced entirely from real data
 * already owned by other modules — Salary (basic pay), Leave (encashable
 * balance across all active leave types), Loan (outstanding EMI balance),
 * and Provident Fund (current balance). Not persisted until processed.
 */
const computeSettlement = async (
  id: string,
  filter: Record<string, unknown>,
  scope: TenantScope
): Promise<{ errorCode: ExitErrorCode; result: ISettlement | null }> => {
  const exit = await findExit(id, filter);
  if (!exit) return { errorCode: "not_found", result: null };

  const employeeId = String(exit.employeeId);
  const salary = await salaryService.getCurrent(employeeId, inTenant(scope));
  const basic = salary?.basic_salary || 0;
  const dailyRate = basic / 30;

  const lastWorkingDay = exit.lastWorkingDay || new Date();
  const pendingSalaryDays = lastWorkingDay.getDate();
  const pendingSalaryAmount = Math.round(dailyRate * pendingSalaryDays);

  const balances = await leaveService.getBalancesForEmployee(employeeId, scope);
  const encashableDays = Math.max(0, balances.reduce((sum, b) => sum + Math.max(0, b.remaining), 0));
  const leaveEncashmentAmount = Math.round(dailyRate * encashableDays);

  const loans = await LoanModel.find({
    employeeId,
    ...inTenant(scope),
    status: { $in: ["Ongoing", "Approved"] },
  }).lean();
  const loanOutstanding = loans.reduce((sum, l) => {
    const unpaid = (l.emiSchedule || []).filter((i) => !i.paid);
    return sum + unpaid.reduce((s, i) => s + (i.emiAmount || 0), 0);
  }, 0);

  const pfAccount = await pfService.getAccountByEmployee(employeeId, inTenant(scope));
  const pfBalance = pfAccount?.currentBalance ?? 0;

  const grossSettlement = pendingSalaryAmount + leaveEncashmentAmount + pfBalance;
  const netSettlement = grossSettlement - loanOutstanding;

  return {
    errorCode: "success",
    result: {
      basic,
      dailyRate: Math.round(dailyRate * 100) / 100,
      pendingSalaryDays,
      pendingSalaryAmount,
      encashableDays,
      leaveEncashmentAmount,
      loanOutstanding,
      pfBalance,
      grossSettlement,
      netSettlement,
      status: "Preview",
      processedOn: null,
    },
  };
};

/**
 * Persists the settlement, pays out the employee's full PF balance (if any),
 * and flips the linked Employee's status to match the exit type — the same
 * kind of cross-module status handoff Onboarding does in reverse.
 */
const markSettlementProcessed = async (
  id: string,
  filter: Record<string, unknown>,
  scope: TenantScope,
  actorId: string
): Promise<ExitResult> => {
  const exit = await findExit(id, filter);
  if (!exit) return { errorCode: "not_found", result: null };
  if (exit.status !== "Settlement") return { errorCode: "invalid_status", result: null };

  const { result: settlement } = await computeSettlement(id, filter, scope);
  if (!settlement) return { errorCode: "not_found", result: null };

  const employeeId = String(exit.employeeId);
  if (settlement.pfBalance && settlement.pfBalance > 0) {
    const applied = await pfService.applyWithdrawal(
      { employeeId, amount: settlement.pfBalance, reason: `Full & final settlement — ${exit.exitType}`, type: "Full" },
      scope,
      actorId
    );
    if (applied.errorCode === "success" && applied.result) {
      await pfService.approveWithdrawal(applied.result.id, inTenant(scope), actorId);
      await pfService.markWithdrawalPaid(applied.result.id, inTenant(scope), actorId);
    }
  }

  const now = new Date();
  exit.settlement = { ...settlement, status: "Processed", processedOn: now };
  exit.markModified("settlement");
  exit.status = "Completed";
  await exit.save();

  await employeeService.update(
    employeeId,
    { status: (EXIT_TYPE_TO_STATUS[exit.exitType || ""] || "resigned") as any },
    filter,
    scope
  );

  return { errorCode: "success", result: mapDbToDto(exit) };
};

const cancelExit = async (id: string, filter: Record<string, unknown>): Promise<ExitResult> => {
  const exit = await findExit(id, filter);
  if (!exit) return { errorCode: "not_found", result: null };
  if (exit.status === "Completed") return { errorCode: "invalid_status", result: null };

  exit.status = "Cancelled";
  await exit.save();
  return { errorCode: "success", result: mapDbToDto(exit) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: ExitListOptions = {}
): Promise<{ totalCount: number; result: exitDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      exitType: "exitType",
      employeeId: "employeeId",
    }),
  };

  if (options.search) {
    const matches = await EmployeeModel.find(
      { ...filter, ...buildSearchCondition(options.search, ["first_name", "last_name", "employeeCode"]) },
      "_id"
    ).lean();
    query.employeeId = { $in: matches.map((e) => e._id) };
  }

  const data = await ExitModel.find(query)
    .populate({
      path: "employeeId",
      select: "first_name last_name employeeCode departmentId designationId",
      populate: [
        { path: "departmentId", select: "name" },
        { path: "designationId", select: "title" },
      ],
    })
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await ExitModel.countDocuments(query);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

interface ExitSummary {
  total: number;
  noticePeriod: number;
  clearance: number;
  settlement: number;
  completed: number;
}

// Tenant-wide totals independent of pagination/search — used for the list
// page's stat tiles.
const getSummary = async (filter: Record<string, unknown>): Promise<ExitSummary> => {
  const base = { ...filter, isDeleted: { $ne: true } };
  const [total, noticePeriod, clearance, settlement, completed] = await Promise.all([
    ExitModel.countDocuments(base),
    ExitModel.countDocuments({ ...base, status: "Notice Period" }),
    ExitModel.countDocuments({ ...base, status: "Clearance" }),
    ExitModel.countDocuments({ ...base, status: "Settlement" }),
    ExitModel.countDocuments({ ...base, status: "Completed" }),
  ]);
  return { total, noticePeriod, clearance, settlement, completed };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<exitDto | null> => {
  const data = await findExit(id, filter);
  return data ? mapDbToDto(data) : null;
};

const getByEmployee = async (employeeId: string, filter: Record<string, unknown>): Promise<exitDto[]> => {
  const data = await ExitModel.find({ employeeId, ...filter, isDeleted: { $ne: true } }).sort({ _id: -1 }).lean();
  return mapDbListToDtoList(data);
};

export {
  initiateExit,
  updateClearanceItem,
  saveExitInterview,
  computeSettlement,
  markSettlementProcessed,
  cancelExit,
  getActiveForEmployee,
  getAll,
  getSummary,
  get,
  getByEmployee,
};
