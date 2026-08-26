import { DesignationModel } from "../../model/designation/designation-model";
import { DepartmentModel } from "../../model/department/department-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { designationDto } from "../../utility/dtos/designation/designation-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/designation/designation-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { getTenantCurrency } from "../account/account-service";

export interface DesignationListOptions {
  search?: string;
  status?: string;
  level?: string;
  departmentId?: string;
}

interface CreateDesignationInput {
  title: string;
  code?: string;
  shortName?: string;
  departmentId: string;
  level?: string;
  grade?: string;
  minSalary?: number;
  maxSalary?: number;
  overtimeRate?: number;
  status?: string;
}

interface DesignationResult {
  errorCode: "success" | "duplicate_entry" | "not_found" | "invalid_department";
  result: designationDto | null;
}

const departmentExists = async (departmentId: string, scope: TenantScope): Promise<boolean> => {
  const department = await DepartmentModel.findOne({
    _id: departmentId,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    isDeleted: { $ne: true },
  }).select("_id").lean();
  return Boolean(department);
};

const create = async (
  data: CreateDesignationInput,
  scope: TenantScope,
  createdBy: string
): Promise<DesignationResult> => {
  if (!(await departmentExists(data.departmentId, scope))) {
    return { errorCode: "invalid_department", result: null };
  }

  if (data.code) {
    const existing = await DesignationModel.findOne({
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      code: data.code,
      isDeleted: { $ne: true },
    }).select("_id").lean();
    if (existing) {
      return { errorCode: "duplicate_entry", result: null };
    }
  }

  const currency = await getTenantCurrency(scope);
  const designation = await DesignationModel.create({
    title: data.title,
    code: data.code || null,
    shortName: data.shortName || null,
    departmentId: data.departmentId,
    level: data.level || null,
    grade: data.grade || null,
    minSalary: data.minSalary ?? null,
    maxSalary: data.maxSalary ?? null,
    overtimeRate: data.overtimeRate ?? null,
    currency,
    status: data.status || "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(designation) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: DesignationListOptions = {}
): Promise<{ totalCount: number; result: designationDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["title", "code", "shortName"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      level: "level",
      departmentId: "departmentId",
    }),
  };

  const data = await DesignationModel.find(query)
    .populate("departmentId", "name")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await DesignationModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<designationDto | null> => {
  const data = await DesignationModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } }).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateDesignationInput>,
  filter: Record<string, unknown>,
  scope: TenantScope
): Promise<DesignationResult> => {
  if (data.departmentId && !(await departmentExists(data.departmentId, scope))) {
    return { errorCode: "invalid_department", result: null };
  }

  // Currency is locked to the tenant's own account currency — never
  // updatable via this endpoint no matter what the client sends.
  const updatePayload: Record<string, unknown> = { ...data };
  delete updatePayload.currency;

  const updated = await DesignationModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: updatePayload },
    { new: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

export interface DeleteDesignationResult {
  errorCode: "success" | "not_found" | "in_use";
}

// Same in-use guard added to Department's delete in this pass — a
// designation still held by an active employee is blocked from deletion
// rather than silently orphaning that employee's reference.
const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<DeleteDesignationResult> => {
  const designation = await DesignationModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } }).lean();
  if (!designation) {
    return { errorCode: "not_found" };
  }
  const inUse = await EmployeeModel.countDocuments({
    designationId: id,
    adminId: designation.adminId,
    merchantId: designation.merchantId,
    isDeleted: { $ne: true },
  });
  if (inUse > 0) {
    return { errorCode: "in_use" };
  }
  await DesignationModel.findOneAndUpdate({ _id: id, ...filter }, { $set: { isDeleted: true } });
  return { errorCode: "success" };
};

export { create, getAll, get, update, deleteByID };
