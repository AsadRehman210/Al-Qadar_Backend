import mongoose from "mongoose";
import { EmployeeRequestModel, IEmployeeRequestModel } from "../../model/employee-request/employee-request-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { employeeRequestDto } from "../../utility/dtos/employee-request/employee-request-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/employee-request/employee-request-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface EmployeeRequestListOptions {
  search?: string;
  status?: string;
  type?: string;
  employeeId?: string;
}

interface CreateRequestInput {
  type: string;
  employeeId: string;
  details?: Record<string, unknown>;
  summary?: string;
  appliedVia: "employee" | "hr";
}

type RequestErrorCode = "success" | "not_found" | "invalid_employee" | "invalid_status";

interface RequestResult {
  errorCode: RequestErrorCode;
  result: employeeRequestDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const generateRequestNumber = async (scope: TenantScope): Promise<string> => {
  const count = await EmployeeRequestModel.countDocuments({ adminId: scope.adminId, merchantId: scope.merchantId });
  return `REQ-${String(count + 1).padStart(4, "0")}`;
};

const findRequest = async (id: string, filter: Record<string, unknown>): Promise<IEmployeeRequestModel | null> => {
  return EmployeeRequestModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });
};

const apply = async (data: CreateRequestInput, scope: TenantScope, createdBy: string): Promise<RequestResult> => {
  const employee = await EmployeeModel.findOne({ _id: data.employeeId, ...inTenant(scope) }).lean();
  if (!employee) return { errorCode: "invalid_employee", result: null };

  const requestNumber = await generateRequestNumber(scope);
  const isHr = data.appliedVia === "hr";

  const request = await EmployeeRequestModel.create({
    requestNumber,
    type: data.type,
    employeeId: data.employeeId,
    managerId: employee.managerEmployeeId || null,
    details: data.details || {},
    summary: data.summary || null,
    appliedVia: data.appliedVia,
    status: isHr ? "Approved" : "Pending Manager",
    managerApproval: isHr
      ? { status: "Skipped", comments: "Created directly by HR — manager approval not required." }
      : { status: "Pending" },
    hrApproval: isHr
      ? { status: "Approved", approvedBy: new mongoose.Types.ObjectId(createdBy), approvedOn: new Date(), comments: "Auto-approved (HR entry)." }
      : { status: "Pending" },
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(request) };
};

const managerApprove = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<RequestResult> => {
  const request = await findRequest(id, filter);
  if (!request) return { errorCode: "not_found", result: null };
  if (request.status !== "Pending Manager") return { errorCode: "invalid_status", result: null };

  request.managerApproval = {
    status: "Approved",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  request.status = "Pending HR";
  await request.save();
  return { errorCode: "success", result: mapDbToDto(request) };
};

const managerReject = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<RequestResult> => {
  const request = await findRequest(id, filter);
  if (!request) return { errorCode: "not_found", result: null };
  if (request.status !== "Pending Manager") return { errorCode: "invalid_status", result: null };

  request.managerApproval = {
    status: "Rejected",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  request.status = "Rejected";
  await request.save();
  return { errorCode: "success", result: mapDbToDto(request) };
};

const hrApprove = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<RequestResult> => {
  const request = await findRequest(id, filter);
  if (!request) return { errorCode: "not_found", result: null };
  if (request.status !== "Pending HR") return { errorCode: "invalid_status", result: null };

  request.hrApproval = {
    status: "Approved",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  request.status = "Approved";
  await request.save();
  return { errorCode: "success", result: mapDbToDto(request) };
};

const hrReject = async (
  id: string,
  filter: Record<string, unknown>,
  approverId: string,
  comments?: string
): Promise<RequestResult> => {
  const request = await findRequest(id, filter);
  if (!request) return { errorCode: "not_found", result: null };
  if (request.status !== "Pending HR") return { errorCode: "invalid_status", result: null };

  request.hrApproval = {
    status: "Rejected",
    approvedBy: new mongoose.Types.ObjectId(approverId),
    approvedOn: new Date(),
    comments: comments || null,
  };
  request.status = "Rejected";
  await request.save();
  return { errorCode: "success", result: mapDbToDto(request) };
};

const cancel = async (id: string, filter: Record<string, unknown>): Promise<RequestResult> => {
  const request = await findRequest(id, filter);
  if (!request) return { errorCode: "not_found", result: null };
  if (request.status === "Rejected" || request.status === "Cancelled") {
    return { errorCode: "invalid_status", result: null };
  }

  request.status = "Cancelled";
  await request.save();
  return { errorCode: "success", result: mapDbToDto(request) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: EmployeeRequestListOptions = {}
): Promise<{ totalCount: number; result: employeeRequestDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["requestNumber"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      type: "type",
      employeeId: "employeeId",
    }),
  };

  const data = await EmployeeRequestModel.find(query)
    .populate({
      path: "employeeId",
      select: "first_name last_name employeeCode departmentId",
      populate: { path: "departmentId", select: "name" },
    })
    .populate("managerId", "first_name last_name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await EmployeeRequestModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<employeeRequestDto | null> => {
  const data = await findRequest(id, filter);
  return data ? mapDbToDto(data) : null;
};

interface EmployeeRequestSummary {
  total: number;
  pendingManager: number;
  pendingHr: number;
  approved: number;
  rejected: number;
}

// Tenant-wide counts by status, independent of pagination/search — used for
// the list page's stat cards and the manager/HR approval shortcut banners.
const getSummary = async (filter: Record<string, unknown>): Promise<EmployeeRequestSummary> => {
  const base = { ...filter, isDeleted: { $ne: true } };
  const [total, pendingManager, pendingHr, approved, rejected] = await Promise.all([
    EmployeeRequestModel.countDocuments(base),
    EmployeeRequestModel.countDocuments({ ...base, status: "Pending Manager" }),
    EmployeeRequestModel.countDocuments({ ...base, status: "Pending HR" }),
    EmployeeRequestModel.countDocuments({ ...base, status: "Approved" }),
    EmployeeRequestModel.countDocuments({ ...base, status: "Rejected" }),
  ]);
  return { total, pendingManager, pendingHr, approved, rejected };
};

const getByEmployee = async (employeeId: string, filter: Record<string, unknown>): Promise<employeeRequestDto[]> => {
  const data = await EmployeeRequestModel.find({ employeeId, ...filter, isDeleted: { $ne: true } }).sort({ _id: -1 }).lean();
  return mapDbListToDtoList(data);
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
};
