import mongoose from "mongoose";
import moment from "moment";
import { LoanModel, ILoanModel, IEmiInstallment } from "../../model/loan/loan-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { loanDto } from "../../utility/dtos/loan/loan-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/loan/loan-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { postAutoJournal } from "../finance/journal-service";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface LoanListOptions {
  search?: string;
  status?: string;
  loanType?: string;
  employeeId?: string;
}

interface CreateLoanInput {
  employeeId: string;
  loanType: string;
  loanPurpose?: string;
  loanAmount: number;
  interestPercent?: number;
  numberOfInstallments: number;
  appliedVia: "employee" | "hr";
  guarantor?: { name?: string; contact?: string; address?: string };
  notes?: string;
  documents?: Array<{ name?: string; type?: string; uploadedAt?: string; uploadedBy?: string; size?: number }>;
}

type LoanErrorCode =
  | "success"
  | "not_found"
  | "invalid_employee"
  | "invalid_status"
  | "invalid_amount"
  | "installment_not_found"
  | "installment_already_paid";

interface LoanResult {
  errorCode: LoanErrorCode;
  result: loanDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const employeeExists = async (employeeId: string, scope: TenantScope): Promise<boolean> => {
  const employee = await EmployeeModel.findOne({ _id: employeeId, ...inTenant(scope) }).select("_id").lean();
  return Boolean(employee);
};

const generateLoanNumber = async (scope: TenantScope): Promise<string> => {
  const count = await LoanModel.countDocuments({ adminId: scope.adminId, merchantId: scope.merchantId });
  return `LOAN-${String(count + 1).padStart(4, "0")}`;
};

const findLoan = async (id: string, filter: Record<string, unknown>): Promise<ILoanModel | null> => {
  return LoanModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });
};

const tenantOfLoan = (loan: ILoanModel): TenantScope => ({
  adminId: loan.adminId ? String(loan.adminId) : null,
  merchantId: loan.merchantId ? String(loan.merchantId) : null,
});

const apply = async (data: CreateLoanInput, scope: TenantScope, createdBy: string): Promise<LoanResult> => {
  if (!(await employeeExists(data.employeeId, scope))) {
    return { errorCode: "invalid_employee", result: null };
  }
  // numberOfInstallments feeds a straight division in disburse() below
  // (totalPayable / installments) — zero/negative here previously produced
  // Infinity/NaN that got saved as monthlyDeduction and then silently
  // corrupted every future Payroll Run's deduction sum for this employee.
  if (!(data.loanAmount > 0) || !Number.isInteger(data.numberOfInstallments) || data.numberOfInstallments <= 0) {
    return { errorCode: "invalid_amount", result: null };
  }

  const loanNumber = await generateLoanNumber(scope);
  const initialStatus = data.appliedVia === "employee" ? "Pending Manager" : "Pending";
  const managerApproval = data.appliedVia === "employee" ? { status: "Pending" as const } : { status: "Skipped" as const };

  const loan = await LoanModel.create({
    loanNumber,
    employeeId: data.employeeId,
    loanType: data.loanType,
    loanPurpose: data.loanPurpose || null,
    loanAmount: data.loanAmount,
    interestPercent: data.interestPercent || 0,
    numberOfInstallments: data.numberOfInstallments,
    monthlyDeduction: 0,
    appliedVia: data.appliedVia,
    managerApproval,
    status: initialStatus,
    guarantor: data.guarantor || null,
    documents: data.documents || [],
    notes: data.notes || null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(loan) };
};

const managerApprove = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<LoanResult> => {
  const loan = await findLoan(id, filter);
  if (!loan) return { errorCode: "not_found", result: null };
  if (loan.status !== "Pending Manager") return { errorCode: "invalid_status", result: null };

  loan.managerApproval = {
    status: "Approved",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  loan.status = "Pending HR";
  await loan.save();
  return { errorCode: "success", result: mapDbToDto(loan) };
};

const managerReject = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<LoanResult> => {
  const loan = await findLoan(id, filter);
  if (!loan) return { errorCode: "not_found", result: null };
  if (loan.status !== "Pending Manager") return { errorCode: "invalid_status", result: null };

  loan.managerApproval = {
    status: "Rejected",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  loan.status = "Rejected";
  loan.rejectedBy = new mongoose.Types.ObjectId(approverId);
  loan.rejectionReason = comments || null;
  loan.rejectedAt = new Date();
  await loan.save();
  return { errorCode: "success", result: mapDbToDto(loan) };
};

const hrApprove = async (id: string, filter: Record<string, unknown>, approverId: string): Promise<LoanResult> => {
  const loan = await findLoan(id, filter);
  if (!loan) return { errorCode: "not_found", result: null };
  if (loan.status !== "Pending HR" && loan.status !== "Pending") return { errorCode: "invalid_status", result: null };

  loan.status = "Approved";
  loan.approvedBy = new mongoose.Types.ObjectId(approverId);
  loan.approvalDate = new Date();
  await loan.save();
  return { errorCode: "success", result: mapDbToDto(loan) };
};

const hrReject = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  reason?: string
): Promise<LoanResult> => {
  const loan = await findLoan(id, filter);
  if (!loan) return { errorCode: "not_found", result: null };
  if (loan.status !== "Pending HR" && loan.status !== "Pending") return { errorCode: "invalid_status", result: null };

  loan.status = "Rejected";
  loan.rejectedBy = new mongoose.Types.ObjectId(approverId);
  loan.rejectionReason = reason || null;
  loan.rejectedAt = new Date();
  await loan.save();
  return { errorCode: "success", result: mapDbToDto(loan) };
};

const disburse = async (id: string, filter: Record<string, unknown>, actorId: string): Promise<LoanResult> => {
  const loan = await findLoan(id, filter);
  if (!loan) return { errorCode: "not_found", result: null };
  if (loan.status !== "Approved") return { errorCode: "invalid_status", result: null };

  const loanAmount = loan.loanAmount || 0;
  const interestPercent = loan.interestPercent || 0;
  const installments = loan.numberOfInstallments || 1;
  const totalInterest = Math.round(loanAmount * (interestPercent / 100) * 100) / 100;
  const totalPayable = Math.round((loanAmount + totalInterest) * 100) / 100;
  const emiAmount = Math.round((totalPayable / installments) * 100) / 100;
  const principalPerInstallment = Math.round((loanAmount / installments) * 100) / 100;
  const interestPerInstallment = Math.round((totalInterest / installments) * 100) / 100;

  // Splitting a total into N equal, cent-rounded installments almost never
  // divides evenly (e.g. 50000/12 rounds to 4166.67/installment, and
  // 4166.67 * 12 = 50000.04 — four cents more than was actually borrowed).
  // Fold that leftover into the LAST installment so the schedule always
  // sums back to the exact loan/interest/payable totals.
  const lastEmiAmount = Math.round((totalPayable - emiAmount * (installments - 1)) * 100) / 100;
  const lastPrincipal = Math.round((loanAmount - principalPerInstallment * (installments - 1)) * 100) / 100;
  const lastInterest = Math.round((totalInterest - interestPerInstallment * (installments - 1)) * 100) / 100;

  const disburseDate = moment();
  let runningBalance = totalPayable;
  const schedule: IEmiInstallment[] = [];
  for (let i = 1; i <= installments; i++) {
    const isLast = i === installments;
    const thisEmi = isLast ? lastEmiAmount : emiAmount;
    runningBalance = Math.round((runningBalance - thisEmi) * 100) / 100;
    schedule.push({
      installmentNo: i,
      dueDate: disburseDate.clone().add(i, "months").toDate(),
      emiAmount: thisEmi,
      principal: isLast ? lastPrincipal : principalPerInstallment,
      interest: isLast ? lastInterest : interestPerInstallment,
      paid: false,
      paidDate: null,
      balance: Math.max(runningBalance, 0),
    });
  }

  loan.emiSchedule = schedule;
  loan.monthlyDeduction = emiAmount;
  loan.status = "Ongoing";
  await loan.save();

  await postAutoJournal({
    tenant: tenantOfLoan(loan),
    createdBy: actorId,
    date: new Date(),
    debitAccountCode: "1200",
    creditAccountCode: "1010",
    amount: loanAmount,
    ref: loan.loanNumber || "",
    source: "Loan Disbursement",
  });

  return { errorCode: "success", result: mapDbToDto(loan) };
};

const recordRepayment = async (
  id: string,
  installmentNo: number,
  filter: Record<string, unknown>,
  actorId: string
): Promise<LoanResult> => {
  const loan = await findLoan(id, filter);
  if (!loan) return { errorCode: "not_found", result: null };
  if (loan.status !== "Ongoing") return { errorCode: "invalid_status", result: null };

  const schedule = loan.emiSchedule || [];
  const installment = schedule.find((row) => row.installmentNo === installmentNo);
  if (!installment) return { errorCode: "installment_not_found", result: null };
  if (installment.paid) return { errorCode: "installment_already_paid", result: null };

  installment.paid = true;
  installment.paidDate = new Date();

  const allPaid = schedule.every((row) => row.paid);
  if (allPaid) {
    loan.status = "Completed";
  }
  loan.markModified("emiSchedule");
  await loan.save();

  await postAutoJournal({
    tenant: tenantOfLoan(loan),
    createdBy: actorId,
    date: new Date(),
    debitAccountCode: "1010",
    creditAccountCode: "1200",
    amount: installment.emiAmount,
    ref: `${loan.loanNumber}-INST-${installmentNo}`,
    source: "Loan Repayment",
  });

  return { errorCode: "success", result: mapDbToDto(loan) };
};

const preClose = async (
  id: string,
  filter: Record<string, unknown>,
  actorId: string,
  requestedAmount?: number
): Promise<LoanResult> => {
  const loan = await findLoan(id, filter);
  if (!loan) return { errorCode: "not_found", result: null };
  if (loan.status !== "Ongoing") return { errorCode: "invalid_status", result: null };

  const schedule = loan.emiSchedule || [];
  const unpaid = schedule.filter((row) => !row.paid);
  const remainingBalance = Math.round(unpaid.reduce((sum, row) => sum + (row.emiAmount || 0), 0) * 100) / 100;
  const settleAmount =
    typeof requestedAmount === "number" && requestedAmount > 0 && requestedAmount <= remainingBalance
      ? requestedAmount
      : remainingBalance;

  const today = new Date();
  unpaid.forEach((row) => {
    row.paid = true;
    row.paidDate = today;
  });
  loan.markModified("emiSchedule");
  loan.status = "Completed";
  loan.preClosureAmount = settleAmount;
  loan.preClosureDate = today;
  await loan.save();

  await postAutoJournal({
    tenant: tenantOfLoan(loan),
    createdBy: actorId,
    date: today,
    debitAccountCode: "1010",
    creditAccountCode: "1200",
    amount: settleAmount,
    ref: `${loan.loanNumber}-PRECLOSE`,
    source: "Loan Pre-Closure",
  });

  return { errorCode: "success", result: mapDbToDto(loan) };
};

// Called once per employee, for every real Payroll Run that actually
// deducted a loan installment for them (see payroll-run-service.computeLine's
// loanDeduction sum) — marks the NEXT unpaid installment on each of their
// Ongoing loans as paid, dated to when payroll actually paid out (not left
// stuck on its original due date/Pending forever). No separate journal
// entry here — the deduction is already folded into payroll's own net-pay
// journal entry (see markAsPaid), not a fresh cash movement of its own.
const markNextInstallmentsPaidFromPayroll = async (
  employeeId: string,
  paidDate: Date,
  scope: TenantScope
): Promise<void> => {
  const loans = await LoanModel.find({ employeeId, ...inTenant(scope), status: "Ongoing" });
  for (const loan of loans) {
    const schedule = loan.emiSchedule || [];
    const next = schedule.find((row) => !row.paid);
    if (!next) continue;

    next.paid = true;
    next.paidDate = paidDate;
    if (schedule.every((row) => row.paid)) {
      loan.status = "Completed";
    }
    loan.markModified("emiSchedule");
    await loan.save();
  }
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: LoanListOptions = {}
): Promise<{ totalCount: number; result: loanDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["loanNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      loanType: "loanType",
      employeeId: "employeeId",
    }),
  };

  const data = await LoanModel.find(query)
    .populate("employeeId", "first_name last_name employeeCode")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await LoanModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<loanDto | null> => {
  const data = await findLoan(id, filter);
  return data ? mapDbToDto(data) : null;
};

const getByEmployee = async (employeeId: string, filter: Record<string, unknown>): Promise<loanDto[]> => {
  const data = await LoanModel.find({ employeeId, ...filter, isDeleted: { $ne: true } }).sort({ _id: -1 }).lean();
  return mapDbListToDtoList(data);
};

export {
  apply,
  managerApprove,
  managerReject,
  hrApprove,
  hrReject,
  disburse,
  recordRepayment,
  preClose,
  markNextInstallmentsPaidFromPayroll,
  getAll,
  get,
  getByEmployee,
};
