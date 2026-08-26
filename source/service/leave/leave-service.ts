import mongoose from "mongoose";
import { LeaveModel, ILeaveModel } from "../../model/leave/leave-model";
import { LeaveTypeModel } from "../../model/leave/leave-type-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { leaveDto } from "../../utility/dtos/leave/leave-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/leave/leave-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface LeaveListOptions {
  search?: string;
  status?: string;
  leaveTypeId?: string;
  departmentId?: string;
  employeeId?: string;
}

interface ApplyLeaveInput {
  employeeId: string;
  leaveTypeId: string;
  fromDate: string | Date;
  toDate: string | Date;
  days: number;
  halfDay?: string;
  reason?: string;
  handoverToEmployeeId?: string;
  emergencyContact?: string;
  attachments?: { name?: string; url?: string }[];
  appliedVia: "employee" | "hr";
}

type LeaveErrorCode =
  | "success"
  | "not_found"
  | "invalid_employee"
  | "invalid_leave_type"
  | "gender_not_applicable"
  | "overlapping_leave"
  | "insufficient_balance"
  | "invalid_days"
  | "invalid_status";

interface LeaveResult {
  errorCode: LeaveErrorCode;
  result: leaveDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const generateLeaveNumber = async (scope: TenantScope): Promise<string> => {
  const count = await LeaveModel.countDocuments({ adminId: scope.adminId, merchantId: scope.merchantId });
  return `LV-${String(count + 1).padStart(4, "0")}`;
};

const findLeave = async (id: string, filter: Record<string, unknown>): Promise<ILeaveModel | null> => {
  return LeaveModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });
};

const hasOverlap = async (
  employeeId: string,
  fromDate: Date,
  toDate: Date,
  scope: TenantScope,
  excludeId?: string
): Promise<boolean> => {
  const query: Record<string, unknown> = {
    employeeId,
    ...inTenant(scope),
    status: { $in: ["Pending Manager", "Pending HR", "Approved"] },
    fromDate: { $lte: toDate },
    toDate: { $gte: fromDate },
  };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await LeaveModel.findOne(query).select("_id").lean();
  return Boolean(existing);
};

// entitled = leaveType.daysPerYear + carryForward; taken/pending are summed
// live from this employee's own Leave records for the current year, rather
// than kept as a separately-maintained running balance — one source of
// truth, no risk of the two drifting out of sync.
const computeBalanceForType = async (
  employeeId: string,
  leaveTypeId: mongoose.Types.ObjectId,
  scope: TenantScope,
  entitled: number
) => {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearEnd = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

  const records = await LeaveModel.find({
    employeeId,
    leaveTypeId,
    ...inTenant(scope),
    fromDate: { $gte: yearStart, $lte: yearEnd },
  }).lean();

  let taken = 0;
  let pending = 0;
  records.forEach((r) => {
    if (r.status === "Approved") taken += r.days || 0;
    else if (r.status === "Pending Manager" || r.status === "Pending HR") pending += r.days || 0;
  });

  return { entitled, taken, pending, remaining: Math.max(0, entitled - taken - pending) };
};

const apply = async (data: ApplyLeaveInput, scope: TenantScope, createdBy: string): Promise<LeaveResult> => {
  const employee = await EmployeeModel.findOne({ _id: data.employeeId, ...inTenant(scope) }).lean();
  if (!employee) return { errorCode: "invalid_employee", result: null };

  const leaveType = await LeaveTypeModel.findOne({ _id: data.leaveTypeId, ...inTenant(scope) }).lean();
  if (!leaveType || leaveType.status !== "Active") return { errorCode: "invalid_leave_type", result: null };

  if (leaveType.applicableGender && leaveType.applicableGender !== "all" && employee.gender !== leaveType.applicableGender) {
    return { errorCode: "gender_not_applicable", result: null };
  }

  // `days` is client-supplied (not derived from fromDate/toDate here), and
  // computeBalanceForType below sums it straight into `taken` for approved
  // records — a negative value previously passed the `data.days >
  // balance.remaining` check trivially and then silently inflated the
  // employee's future remaining balance once approved.
  if (!(data.days > 0)) {
    return { errorCode: "invalid_days", result: null };
  }

  const fromDate = new Date(data.fromDate);
  const toDate = new Date(data.toDate);

  if (await hasOverlap(data.employeeId, fromDate, toDate, scope)) {
    return { errorCode: "overlapping_leave", result: null };
  }

  const entitled = (leaveType.daysPerYear || 0) + (leaveType.carryForward || 0);
  const balance = await computeBalanceForType(data.employeeId, leaveType._id as mongoose.Types.ObjectId, scope, entitled);
  if (data.days > balance.remaining) {
    return { errorCode: "insufficient_balance", result: null };
  }

  const leaveNumber = await generateLeaveNumber(scope);
  const isSelfService = data.appliedVia === "employee";
  const status = isSelfService ? "Pending Manager" : "Approved";
  const managerApproval = isSelfService ? { status: "Pending" as const } : { status: "Skipped" as const };
  const hrApproval = isSelfService
    ? { status: "Pending" as const }
    : { status: "Approved" as const, approvedBy: new mongoose.Types.ObjectId(createdBy), approvedOn: new Date(), comments: "Created by HR — auto-approved." };

  const leave = await LeaveModel.create({
    leaveNumber,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    fromDate,
    toDate,
    days: data.days,
    halfDay: data.halfDay || "full",
    reason: data.reason || null,
    handoverToEmployeeId: data.handoverToEmployeeId || null,
    emergencyContact: data.emergencyContact || null,
    attachments: data.attachments || [],
    appliedVia: data.appliedVia,
    status,
    appliedAt: new Date(),
    managerApproval,
    hrApproval,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(leave) };
};

const managerApprove = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<LeaveResult> => {
  const leave = await findLeave(id, filter);
  if (!leave) return { errorCode: "not_found", result: null };
  if (leave.status !== "Pending Manager") return { errorCode: "invalid_status", result: null };

  leave.managerApproval = {
    status: "Approved",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  leave.status = "Pending HR";
  await leave.save();
  return { errorCode: "success", result: mapDbToDto(leave) };
};

const managerReject = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<LeaveResult> => {
  const leave = await findLeave(id, filter);
  if (!leave) return { errorCode: "not_found", result: null };
  if (leave.status !== "Pending Manager") return { errorCode: "invalid_status", result: null };

  leave.managerApproval = {
    status: "Rejected",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  leave.status = "Rejected";
  await leave.save();
  return { errorCode: "success", result: mapDbToDto(leave) };
};

const hrApprove = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<LeaveResult> => {
  const leave = await findLeave(id, filter);
  if (!leave) return { errorCode: "not_found", result: null };
  if (leave.status !== "Pending HR") return { errorCode: "invalid_status", result: null };

  leave.hrApproval = {
    status: "Approved",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  leave.status = "Approved";
  await leave.save();
  return { errorCode: "success", result: mapDbToDto(leave) };
};

const hrReject = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<LeaveResult> => {
  const leave = await findLeave(id, filter);
  if (!leave) return { errorCode: "not_found", result: null };
  if (leave.status !== "Pending HR") return { errorCode: "invalid_status", result: null };

  leave.hrApproval = {
    status: "Rejected",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  leave.status = "Rejected";
  await leave.save();
  return { errorCode: "success", result: mapDbToDto(leave) };
};

const cancel = async (id: string, filter: Record<string, unknown>): Promise<LeaveResult> => {
  const leave = await findLeave(id, filter);
  if (!leave) return { errorCode: "not_found", result: null };
  if (leave.status === "Rejected" || leave.status === "Cancelled") {
    return { errorCode: "invalid_status", result: null };
  }
  leave.status = "Cancelled";
  await leave.save();
  return { errorCode: "success", result: mapDbToDto(leave) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: LeaveListOptions = {}
): Promise<{ totalCount: number; result: leaveDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["leaveNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      leaveTypeId: "leaveTypeId",
      employeeId: "employeeId",
    }),
  };

  if (options.departmentId) {
    const employeesInDept = await EmployeeModel.find(
      { ...filter, departmentId: options.departmentId },
      "_id"
    ).lean();
    query.employeeId = { $in: employeesInDept.map((e) => e._id) };
  }

  const data = await LeaveModel.find(query)
    .populate({
      path: "employeeId",
      select: "first_name last_name employeeCode departmentId",
      populate: { path: "departmentId", select: "name" },
    })
    .populate("leaveTypeId", "name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await LeaveModel.countDocuments(query);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

interface LeaveSummary {
  total: number;
  pending: number;
  pendingManager: number;
  pendingHr: number;
  approved: number;
  rejected: number;
}

// Tenant-wide counts by status, independent of pagination/search — used for
// the list page's stat cards and the manager/HR approval shortcut banners.
const getSummary = async (filter: Record<string, unknown>): Promise<LeaveSummary> => {
  const base = { ...filter, isDeleted: { $ne: true } };
  const [total, pendingManager, pendingHr, approved, rejected] = await Promise.all([
    LeaveModel.countDocuments(base),
    LeaveModel.countDocuments({ ...base, status: "Pending Manager" }),
    LeaveModel.countDocuments({ ...base, status: "Pending HR" }),
    LeaveModel.countDocuments({ ...base, status: "Approved" }),
    LeaveModel.countDocuments({ ...base, status: "Rejected" }),
  ]);
  return { total, pending: pendingManager + pendingHr, pendingManager, pendingHr, approved, rejected };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<leaveDto | null> => {
  const data = await findLeave(id, filter);
  return data ? mapDbToDto(data) : null;
};

const getByEmployee = async (employeeId: string, filter: Record<string, unknown>): Promise<leaveDto[]> => {
  const data = await LeaveModel.find({ employeeId, ...filter, isDeleted: { $ne: true } }).sort({ _id: -1 }).lean();
  return mapDbListToDtoList(data);
};

interface LeaveBalanceEntry {
  leaveTypeId: string;
  leaveTypeName: string;
  entitled: number;
  taken: number;
  pending: number;
  remaining: number;
}

const getBalancesForEmployee = async (
  employeeId: string,
  scope: TenantScope
): Promise<LeaveBalanceEntry[]> => {
  const leaveTypes = await LeaveTypeModel.find({ ...inTenant(scope), status: "Active" }).lean();
  const balances: LeaveBalanceEntry[] = [];
  for (const type of leaveTypes) {
    const entitled = (type.daysPerYear || 0) + (type.carryForward || 0);
    const balance = await computeBalanceForType(employeeId, type._id as mongoose.Types.ObjectId, scope, entitled);
    balances.push({
      leaveTypeId: String(type._id),
      leaveTypeName: type.name || "",
      ...balance,
    });
  }
  return balances;
};

export {
  apply,
  managerApprove,
  managerReject,
  hrApprove,
  hrReject,
  cancel,
  getAll,
  getSummary,
  get,
  getByEmployee,
  getBalancesForEmployee,
};
