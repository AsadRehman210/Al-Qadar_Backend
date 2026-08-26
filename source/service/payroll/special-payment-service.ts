import mongoose from "mongoose";
import { SpecialPaymentModel, ISpecialPaymentModel } from "../../model/payroll/special-payment-model";
import { SpecialPaymentTypeModel } from "../../model/payroll/special-payment-type-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { SalaryModel } from "../../model/salary/salary-model";
import { specialPaymentDto } from "../../utility/dtos/payroll/special-payment-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/payroll/special-payment-mapper";
import { TenantScope, toAggregateFilter } from "../../utility/helper/tenant-scope";
import { postAutoJournal } from "../finance/journal-service";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface SpecialPaymentListOptions {
  search?: string;
  status?: string;
  typeId?: string;
  target?: string;
}

interface CreateSpecialPaymentInput {
  title: string;
  typeId: string;
  target: "all" | "department" | "individual" | "custom";
  departmentId?: string;
  employeeId?: string;
  customEmployeeIds?: string[];
  notes?: string;
}

type SpErrorCode = "success" | "not_found" | "invalid_type" | "no_employees" | "invalid_status";

interface SpResult {
  errorCode: SpErrorCode;
  result: specialPaymentDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const findPayment = async (id: string, filter: Record<string, unknown>): Promise<ISpecialPaymentModel | null> =>
  SpecialPaymentModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });

// basic + the same allowance set Salary tracks, matching how gross pay is
// computed everywhere else this session (Payroll Run does the same sum).
const resolveGross = async (employeeId: mongoose.Types.ObjectId, scope: TenantScope): Promise<{ basic: number; gross: number }> => {
  const salary = await SalaryModel.findOne({ employeeId, ...inTenant(scope) }).sort({ effective_from: -1 }).lean();
  const basic = salary?.basic_salary || 0;
  const a = salary?.allowances;
  const gross =
    basic +
    (a?.hra || 0) +
    (a?.medical_allowance || 0) +
    (a?.transport_allowance || 0) +
    (a?.food_allowance || 0) +
    (a?.mobile_allowance || 0) +
    (a?.travel_allowance || 0) +
    (a?.other_allowances || 0);
  return { basic, gross };
};

const resolveAmount = (amountMode: string, amountValue: number, basic: number, gross: number): number => {
  if (amountMode === "pct_basic") return Math.round((basic * amountValue) / 100);
  if (amountMode === "pct_gross") return Math.round((gross * amountValue) / 100);
  return amountValue;
};

const create = async (
  data: CreateSpecialPaymentInput,
  scope: TenantScope,
  createdBy: string
): Promise<SpResult> => {
  const type = await SpecialPaymentTypeModel.findOne({ _id: data.typeId, ...inTenant(scope) }).lean();
  if (!type) return { errorCode: "invalid_type", result: null };

  // Probation employees are already drawing salary and are eligible for
  // special payments too — only genuinely inactive statuses are excluded.
  const eligibleStatus = { $in: ["active", "probation"] };
  let employeeIds: mongoose.Types.ObjectId[] = [];
  if (data.target === "all") {
    const emps = await EmployeeModel.find({ ...inTenant(scope), status: eligibleStatus }, { _id: 1 }).lean();
    employeeIds = emps.map((e) => e._id as mongoose.Types.ObjectId);
  } else if (data.target === "department" && data.departmentId) {
    const emps = await EmployeeModel.find(
      { ...inTenant(scope), status: eligibleStatus, departmentId: data.departmentId },
      { _id: 1 }
    ).lean();
    employeeIds = emps.map((e) => e._id as mongoose.Types.ObjectId);
  } else if (data.target === "individual" && data.employeeId) {
    const emps = await EmployeeModel.find({ ...inTenant(scope), status: eligibleStatus, _id: data.employeeId }, { _id: 1 }).lean();
    employeeIds = emps.map((e) => e._id as mongoose.Types.ObjectId);
  } else if (data.target === "custom" && data.customEmployeeIds?.length) {
    // Re-queried against the tenant (not trusted verbatim from the request
    // body) — matches the "all"/"department" branches above, which already
    // derive employeeIds from a tenant-scoped query rather than embedding
    // whatever IDs the client sent. Without this, a foreign or nonexistent
    // employeeId got persisted into payment.employees[] as if it were real,
    // silently inflating totalAmount with a phantom line.
    const emps = await EmployeeModel.find(
      { ...inTenant(scope), status: eligibleStatus, _id: { $in: data.customEmployeeIds } },
      { _id: 1 }
    ).lean();
    employeeIds = emps.map((e) => e._id as mongoose.Types.ObjectId);
  }

  if (!employeeIds.length) return { errorCode: "no_employees", result: null };

  const lines = [];
  let totalAmount = 0;
  for (const employeeId of employeeIds) {
    const { basic, gross } = await resolveGross(employeeId, scope);
    const amount = resolveAmount(type.amountMode || "fixed", type.amountValue || 0, basic, gross);
    totalAmount += amount;
    lines.push({ employeeId, amount, paymentStatus: "Pending" as const });
  }

  const payment = await SpecialPaymentModel.create({
    title: data.title,
    typeId: data.typeId,
    target: data.target,
    departmentId: data.departmentId || null,
    employeeId: data.employeeId || null,
    customEmployeeIds: data.target === "custom" ? employeeIds : [],
    employees: lines,
    totalAmount,
    status: "Draft",
    notes: data.notes || null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(payment) };
};

const submitForApproval = async (id: string, filter: Record<string, unknown>): Promise<SpResult> => {
  const payment = await findPayment(id, filter);
  if (!payment) return { errorCode: "not_found", result: null };
  if (payment.status !== "Draft") return { errorCode: "invalid_status", result: null };
  payment.status = "Pending Approval";
  await payment.save();
  return { errorCode: "success", result: mapDbToDto(payment) };
};

const approve = async (id: string, filter: Record<string, unknown>, approverId: string): Promise<SpResult> => {
  const payment = await findPayment(id, filter);
  if (!payment) return { errorCode: "not_found", result: null };
  if (payment.status !== "Pending Approval") return { errorCode: "invalid_status", result: null };
  payment.status = "Approved";
  payment.approvedBy = new mongoose.Types.ObjectId(approverId);
  payment.approvedOn = new Date();
  await payment.save();
  return { errorCode: "success", result: mapDbToDto(payment) };
};

const reject = async (id: string, filter: Record<string, unknown>, reason?: string): Promise<SpResult> => {
  const payment = await findPayment(id, filter);
  if (!payment) return { errorCode: "not_found", result: null };
  if (payment.status !== "Pending Approval") return { errorCode: "invalid_status", result: null };
  payment.status = "Draft";
  payment.notes = reason || payment.notes || null;
  await payment.save();
  return { errorCode: "success", result: mapDbToDto(payment) };
};

const markPaid = async (id: string, filter: Record<string, unknown>, actorId: string): Promise<SpResult> => {
  const payment = await findPayment(id, filter);
  if (!payment) return { errorCode: "not_found", result: null };
  if (payment.status !== "Approved") return { errorCode: "invalid_status", result: null };

  payment.status = "Paid";
  payment.paidOn = new Date();
  payment.employees = (payment.employees || []).map((e) => ({ ...e, paymentStatus: "Paid" as const }));
  await payment.save();

  // Same zero-guard Payroll Run's own markAsPaid already applies (`if
  // (run.totalNet)`) — without it, a zero-amount payment type still posted
  // a degenerate Dr 0 / Cr 0 journal entry.
  if (payment.totalAmount && payment.totalAmount > 0) {
    await postAutoJournal({
      tenant: { adminId: payment.adminId ? String(payment.adminId) : null, merchantId: payment.merchantId ? String(payment.merchantId) : null },
      createdBy: actorId,
      date: new Date(),
      debitAccountCode: "5000",
      creditAccountCode: "1010",
      amount: payment.totalAmount || 0,
      ref: payment.title || "",
      source: "Special Payment",
    });
  }

  return { errorCode: "success", result: mapDbToDto(payment) };
};

const cancel = async (id: string, filter: Record<string, unknown>): Promise<SpResult> => {
  const payment = await findPayment(id, filter);
  if (!payment) return { errorCode: "not_found", result: null };
  if (payment.status === "Paid" || payment.status === "Cancelled") {
    return { errorCode: "invalid_status", result: null };
  }
  payment.status = "Cancelled";
  await payment.save();
  return { errorCode: "success", result: mapDbToDto(payment) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: SpecialPaymentListOptions = {}
): Promise<{ totalCount: number; result: specialPaymentDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["title"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status", typeId: "typeId", target: "target" }),
  };
  const data = await SpecialPaymentModel.find(query)
    .populate("typeId", "name icon")
    .populate("departmentId", "name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await SpecialPaymentModel.countDocuments(query);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<specialPaymentDto | null> => {
  const data = await findPayment(id, filter);
  return data ? mapDbToDto(data) : null;
};

interface SpecialPaymentSummary {
  totalPaid: number;
  paidCount: number;
  totalPending: number;
  pendingCount: number;
  draftCount: number;
  totalCount: number;
}

// Tenant-wide totals independent of pagination/search — used for the list
// page's stat cards.
const getSummary = async (filter: Record<string, unknown>): Promise<SpecialPaymentSummary> => {
  const base = { ...filter, isDeleted: { $ne: true } };
  const aggBase = toAggregateFilter(base);
  const [totalCount, draftCount, paidAgg, pendingAgg] = await Promise.all([
    SpecialPaymentModel.countDocuments(base),
    SpecialPaymentModel.countDocuments({ ...base, status: "Draft" }),
    SpecialPaymentModel.aggregate([
      { $match: { ...aggBase, status: "Paid" } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$totalAmount" } } },
    ]),
    SpecialPaymentModel.aggregate([
      { $match: { ...aggBase, status: { $in: ["Approved", "Pending Approval"] } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$totalAmount" } } },
    ]),
  ]);
  const paid = paidAgg[0] || { count: 0, total: 0 };
  const pending = pendingAgg[0] || { count: 0, total: 0 };
  return {
    totalPaid: paid.total || 0,
    paidCount: paid.count || 0,
    totalPending: pending.total || 0,
    pendingCount: pending.count || 0,
    draftCount,
    totalCount,
  };
};

export { create, submitForApproval, approve, reject, markPaid, cancel, getAll, getSummary, get };
