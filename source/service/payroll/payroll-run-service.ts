import mongoose from "mongoose";
import { PayrollRunModel, IPayrollRunModel, IPayrollLine } from "../../model/payroll/payroll-run-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { DesignationModel } from "../../model/designation/designation-model";
import { SalaryModel } from "../../model/salary/salary-model";
import { AttendanceModel } from "../../model/attendance/attendance-model";
import { AttendancePolicyModel } from "../../model/attendance/attendance-policy-model";
import { LoanModel } from "../../model/loan/loan-model";
import { PFPolicyModel } from "../../model/provident-fund/pf-policy-model";
import { postContributionFromPayroll } from "../provident-fund/pf-service";
import { markNextInstallmentsPaidFromPayroll } from "../loan/loan-service";
import { payrollRunDto, payrollEmployeeHistoryDto } from "../../utility/dtos/payroll/payroll-run-dto";
import { mapDbToDto, mapDbListToDtoList, mapLine } from "../../utility/mapper/payroll/payroll-run-mapper";
import { TenantScope, toAggregateFilter } from "../../utility/helper/tenant-scope";
import { postAutoJournal } from "../finance/journal-service";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface PayrollRunListOptions {
  search?: string;
  status?: string;
  month?: string;
}

interface LineOverride {
  bonus?: number;
  arrears?: number;
  overtimeHours?: number;
}

interface CreateRunInput {
  month: string; // "YYYY-MM"
  employeeIds: string[];
  overrides?: Record<string, LineOverride>;
  notes?: string;
}

type RunErrorCode = "success" | "not_found" | "no_employees" | "invalid_status" | "duplicate_run";

interface RunResult {
  errorCode: RunErrorCode;
  result: payrollRunDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const generateRunNumber = async (scope: TenantScope): Promise<string> => {
  const count = await PayrollRunModel.countDocuments({ adminId: scope.adminId, merchantId: scope.merchantId });
  return `PR-${String(count + 1).padStart(4, "0")}`;
};

const findRun = async (id: string, filter: Record<string, unknown>): Promise<IPayrollRunModel | null> =>
  PayrollRunModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });

// Pulls basic/allowances from the employee's current Salary record, overtime
// rate from their Designation, active Loan monthly deductions, PF employee/
// employer contribution from the tenant's PF policy rate, and an attendance-
// based deduction from real absent days that month — the same ingredients
// the old fake-data calculator used, just sourced from the real collections
// each of those modules now own instead of one disconnected formula.
const computeLine = async (
  employeeId: mongoose.Types.ObjectId,
  month: string,
  scope: TenantScope,
  override: LineOverride = {}
): Promise<IPayrollLine> => {
  const employee = await EmployeeModel.findOne({ _id: employeeId, ...inTenant(scope) }).lean();
  // Match salary-service.getCurrent() exactly — effective_to: null is the
  // one unambiguous "current" record. Sorting by effective_from and taking
  // the top one isn't safe: every re-save from the Salary tab that doesn't
  // change the effective date creates a new record with the SAME
  // effective_from, and a sort tie-break isn't guaranteed to land on the
  // actually-current (still-open) one.
  const salary = await SalaryModel.findOne({ employeeId, ...inTenant(scope), effective_to: null }).lean();
  const designation = employee?.designationId
    ? await DesignationModel.findOne({ _id: employee.designationId, ...inTenant(scope) }).lean()
    : null;
  const policy = await AttendancePolicyModel.findOne({ ...inTenant(scope), endDate: null }).lean();

  const basic = salary?.basic_salary || 0;
  const a = salary?.allowances;
  const hra = a?.hra || 0;
  const medical = a?.medical_allowance || 0;
  const transport = a?.transport_allowance || 0;
  const food = a?.food_allowance || 0;
  const mobile = a?.mobile_allowance || 0;

  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const monthAttendance = await AttendanceModel.find({
    employeeId,
    ...inTenant(scope),
    date: { $gte: monthStart, $lt: monthEnd },
  }).lean();

  const overtimeRate = designation?.overtimeRate || 0;
  const overtimeHours =
    override.overtimeHours ?? monthAttendance.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
  const overtime = Math.round(overtimeHours * overtimeRate);

  const bonus = override.bonus || 0;
  const arrears = override.arrears || 0;
  const grossEarnings = basic + hra + medical + transport + food + mobile + overtime + bonus + arrears;

  // The employee's own PF contribution is whatever their Salary record says
  // (entered as a % there, see Salary.jsx) — not a separate company-wide
  // rate. The employer's side is a company-wide MULTIPLIER of that same
  // amount (1 = match it, 0.5 = half, 2 = double, etc — see PFPolicy page),
  // not an independent %-of-basic calculation.
  const pfPolicy = await PFPolicyModel.findOne(inTenant(scope)).lean();
  const pfPercentage = salary?.pf_percentage || 0;
  const pfEmployerMultiplier = pfPolicy?.employerContributionMultiplier ?? 1;
  const pfEmployee = salary?.deductions?.provident_fund || 0;
  const pfEmployer = Math.round(pfEmployee * pfEmployerMultiplier);

  const activeLoans = await LoanModel.find({ employeeId, ...inTenant(scope), status: "Ongoing" }).lean();
  const loanDeduction = activeLoans.reduce((sum, l) => sum + (l.monthlyDeduction || 0), 0);

  const d = salary?.deductions;
  const incomeTax = d?.tax || 0;
  const insurance = d?.insurance_deduction || 0;
  const advance = d?.advance_salary || 0;
  const otherDeductions = d?.other_deductions || 0;

  const salaryCalculationDays = policy?.salaryCalculationDays || 30;
  const absentDays = monthAttendance.filter((r) => r.status === "Absent").length;
  const dailyRate = salaryCalculationDays ? basic / salaryCalculationDays : 0;
  const attendanceDeduction = Math.round(absentDays * dailyRate);

  const totalDeductions = pfEmployee + incomeTax + insurance + loanDeduction + advance + attendanceDeduction + otherDeductions;
  const netPay = grossEarnings - totalDeductions;
  const employerCost = grossEarnings + pfEmployer;

  return {
    employeeId,
    basic, hra, medical, transport, food, mobile,
    overtimeHours, overtimeRate, overtime, bonus, arrears,
    grossEarnings,
    pfEmployee, pfEmployer, pfPercentage, pfEmployerMultiplier,
    incomeTax, insurance, loanDeduction, advance, attendanceDeduction, otherDeductions,
    totalDeductions,
    netPay,
    employerCost,
    paymentStatus: "Pending",
    paymentDate: null,
    paymentRef: null,
  };
};

const sumTotals = (lines: IPayrollLine[]) => ({
  totalGross: lines.reduce((s, l) => s + (l.grossEarnings || 0), 0),
  totalDeductions: lines.reduce((s, l) => s + (l.totalDeductions || 0), 0),
  totalNet: lines.reduce((s, l) => s + (l.netPay || 0), 0),
  totalEmployerCost: lines.reduce((s, l) => s + (l.employerCost || 0), 0),
});

// Any non-Cancelled run for the same month that already covers one of
// these employees blocks a new run — without this, two runs for the same
// employee/month could each independently reach markAsPaid and each post
// its own full-amount `Dr 5000 / Cr 1010` journal entry (and each mark the
// same loan installments/PF contribution paid a second time).
const hasOverlappingRun = async (
  month: string,
  employeeIds: string[],
  scope: TenantScope
): Promise<boolean> => {
  const existing = await PayrollRunModel.findOne({
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    month,
    status: { $ne: "Cancelled" },
    "employees.employeeId": { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).select("_id").lean();
  return Boolean(existing);
};

const create = async (data: CreateRunInput, scope: TenantScope, createdBy: string): Promise<RunResult> => {
  if (!data.employeeIds?.length) return { errorCode: "no_employees", result: null };
  if (await hasOverlappingRun(data.month, data.employeeIds, scope)) {
    return { errorCode: "duplicate_run", result: null };
  }

  const lines: IPayrollLine[] = [];
  for (const id of data.employeeIds) {
    const line = await computeLine(new mongoose.Types.ObjectId(id), data.month, scope, data.overrides?.[id]);
    lines.push(line);
  }

  const runNumber = await generateRunNumber(scope);
  const run = await PayrollRunModel.create({
    runNumber,
    month: data.month,
    status: "Draft",
    employees: lines,
    ...sumTotals(lines),
    notes: data.notes || null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(run) };
};

const recomputeLine = async (
  id: string,
  employeeId: string,
  override: LineOverride,
  filter: Record<string, unknown>,
  scope: TenantScope
): Promise<RunResult> => {
  const run = await findRun(id, filter);
  if (!run) return { errorCode: "not_found", result: null };
  if (run.status !== "Draft") return { errorCode: "invalid_status", result: null };

  const newLine = await computeLine(new mongoose.Types.ObjectId(employeeId), run.month || "", scope, override);
  run.employees = (run.employees || []).map((l) => (String(l.employeeId) === employeeId ? newLine : l));
  Object.assign(run, sumTotals(run.employees));
  await run.save();
  return { errorCode: "success", result: mapDbToDto(run) };
};

const submitForApproval = async (id: string, filter: Record<string, unknown>): Promise<RunResult> => {
  const run = await findRun(id, filter);
  if (!run) return { errorCode: "not_found", result: null };
  if (run.status !== "Draft") return { errorCode: "invalid_status", result: null };
  run.status = "Pending Approval";
  await run.save();
  return { errorCode: "success", result: mapDbToDto(run) };
};

const approve = async (id: string, filter: Record<string, unknown>, approverId: string): Promise<RunResult> => {
  const run = await findRun(id, filter);
  if (!run) return { errorCode: "not_found", result: null };
  if (run.status !== "Pending Approval") return { errorCode: "invalid_status", result: null };
  run.status = "Approved";
  run.approvedBy = new mongoose.Types.ObjectId(approverId);
  run.approvedOn = new Date();
  await run.save();
  return { errorCode: "success", result: mapDbToDto(run) };
};

const reject = async (id: string, filter: Record<string, unknown>, reason?: string): Promise<RunResult> => {
  const run = await findRun(id, filter);
  if (!run) return { errorCode: "not_found", result: null };
  if (run.status !== "Pending Approval") return { errorCode: "invalid_status", result: null };
  run.status = "Draft";
  run.notes = reason || run.notes || null;
  await run.save();
  return { errorCode: "success", result: mapDbToDto(run) };
};

const process_ = async (id: string, filter: Record<string, unknown>): Promise<RunResult> => {
  const run = await findRun(id, filter);
  if (!run) return { errorCode: "not_found", result: null };
  if (run.status !== "Approved") return { errorCode: "invalid_status", result: null };
  run.status = "Processing";
  await run.save();
  return { errorCode: "success", result: mapDbToDto(run) };
};

const markAsPaid = async (id: string, filter: Record<string, unknown>, actorId: string): Promise<RunResult> => {
  const run = await findRun(id, filter);
  if (!run) return { errorCode: "not_found", result: null };
  if (run.status !== "Processing" && run.status !== "Approved") return { errorCode: "invalid_status", result: null };

  const now = new Date();
  run.status = "Paid";
  run.processedOn = now;
  run.employees = (run.employees || []).map((l) => ({
    ...l,
    paymentStatus: "Paid" as const,
    paymentDate: now,
    paymentRef: `PAY-${Math.floor(Math.random() * 90000 + 10000)}`,
  }));
  await run.save();

  const tenant = { adminId: run.adminId ? String(run.adminId) : null, merchantId: run.merchantId ? String(run.merchantId) : null };
  if (run.totalNet) {
    await postAutoJournal({
      tenant,
      createdBy: actorId,
      date: now,
      debitAccountCode: "5000",
      creditAccountCode: "1010",
      amount: run.totalNet,
      ref: run.runNumber || "",
      source: "Payroll Run",
    });
  }

  // Getting paid IS the PF contribution event — post one per employee so
  // the Employee Detail page's Provident Fund tab actually reflects this
  // run, using the amounts already computed on the line (never a fresh
  // policy-rate calculation).
  for (const line of run.employees || []) {
    if (!line.employeeId) continue;
    await postContributionFromPayroll(
      String(line.employeeId),
      run.month || "",
      line.basic || 0,
      line.pfEmployee || 0,
      line.pfEmployer || 0,
      line.pfPercentage || 0,
      line.pfEmployerMultiplier ?? 1,
      tenant,
      actorId
    );

    // Same idea for loans — a line with a loan deduction means payroll
    // actually withheld that installment, so mark it paid (dated to today,
    // when it was really paid) instead of leaving it on Pending until
    // someone remembers to do it by hand on the Loan page.
    if (line.loanDeduction) {
      await markNextInstallmentsPaidFromPayroll(String(line.employeeId), now, tenant);
    }
  }

  return { errorCode: "success", result: mapDbToDto(run) };
};

const cancel = async (id: string, filter: Record<string, unknown>): Promise<RunResult> => {
  const run = await findRun(id, filter);
  if (!run) return { errorCode: "not_found", result: null };
  if (run.status === "Paid" || run.status === "Cancelled") return { errorCode: "invalid_status", result: null };
  run.status = "Cancelled";
  await run.save();
  return { errorCode: "success", result: mapDbToDto(run) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: PayrollRunListOptions = {}
): Promise<{ totalCount: number; result: payrollRunDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["runNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status", month: "month" }),
  };
  const data = await PayrollRunModel.find(query).skip(startIndex).limit(limit).sort({ _id: -1 }).lean();
  const count = await PayrollRunModel.countDocuments(query);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<payrollRunDto | null> => {
  const data = await findRun(id, filter);
  return data ? mapDbToDto(data) : null;
};

// One employee's line across every real payroll run that included them —
// this is what "paid" or "pending" actually means (a run's own processing
// status), not the Salary record's own payment_status field.
const getByEmployee = async (
  employeeId: string,
  filter: Record<string, unknown>
): Promise<payrollEmployeeHistoryDto[]> => {
  const runs = await PayrollRunModel.find({
    ...filter,
    isDeleted: { $ne: true },
    "employees.employeeId": employeeId,
    // Draft (not yet submitted, numbers can still change) and Cancelled
    // (voided, never actually processed) aren't real salary history — only
    // runs that at least reached approval represent genuine paid/pending pay.
    status: { $nin: ["Draft", "Cancelled"] },
  }).sort({ month: -1 }).lean();

  const history: payrollEmployeeHistoryDto[] = [];
  for (const run of runs) {
    const line = (run.employees || []).find((l) => String(l.employeeId) === employeeId);
    if (!line) continue;
    history.push({
      runId: String(run._id),
      runNumber: run.runNumber || null,
      month: run.month || null,
      runStatus: run.status || null,
      line: mapLine(line),
    });
  }
  return history;
};

export interface FlattenedPayrollLine {
  runId: string;
  month: string | null;
  employeeId: string;
  line: ReturnType<typeof mapLine>;
}

// Every employee's line across every real run, flattened and paginated —
// backs the Salary module's "no employee filter picked" view. Runs
// themselves are few (one per month), so building the flattened list in
// memory and slicing it (same approach getExpiryBucketDetail/getStockView
// already use for other derived-list endpoints) is simpler than a raw
// Mongo $unwind pipeline and stays within the same bounds getByEmployee
// already accepts for a single employee.
const getAllEmployeesHistory = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: FlattenedPayrollLine[] }> => {
  const runs = await PayrollRunModel.find({
    ...filter,
    isDeleted: { $ne: true },
    status: { $nin: ["Draft", "Cancelled"] },
  }).sort({ month: -1 }).lean();

  const flattened: FlattenedPayrollLine[] = [];
  for (const run of runs) {
    for (const line of run.employees || []) {
      if (!line.employeeId) continue;
      flattened.push({
        runId: `${String(run._id)}-${String(line.employeeId)}`,
        month: run.month || null,
        employeeId: String(line.employeeId),
        line: mapLine(line),
      });
    }
  }

  const startIndex = (page - 1) * limit;
  return { totalCount: flattened.length, result: flattened.slice(startIndex, startIndex + limit) };
};

interface PayrollRunSummary {
  totalRuns: number;
  pendingApproval: number;
  paidRuns: number;
  totalNetPaid: number;
}

// Tenant-wide totals independent of pagination/search — used for the list
// page's stat cards.
const getSummary = async (filter: Record<string, unknown>): Promise<PayrollRunSummary> => {
  const base = { ...filter, isDeleted: { $ne: true } };
  const [totalRuns, pendingApproval, paidAgg] = await Promise.all([
    PayrollRunModel.countDocuments(base),
    PayrollRunModel.countDocuments({ ...base, status: "Pending Approval" }),
    PayrollRunModel.aggregate([
      { $match: { ...toAggregateFilter(base), status: "Paid" } },
      { $group: { _id: null, count: { $sum: 1 }, totalNetPaid: { $sum: "$totalNet" } } },
    ]),
  ]);
  const paid = paidAgg[0] || { count: 0, totalNetPaid: 0 };
  return { totalRuns, pendingApproval, paidRuns: paid.count, totalNetPaid: paid.totalNetPaid || 0 };
};

export {
  create,
  recomputeLine,
  submitForApproval,
  approve,
  reject,
  process_ as process,
  markAsPaid,
  cancel,
  getAll,
  getSummary,
  get,
  getByEmployee,
  getAllEmployeesHistory,
};
