import { DepartmentModel } from "../../model/department/department-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { departmentDto } from "../../utility/dtos/department/department-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/department/department-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface DepartmentListOptions {
  search?: string;
  status?: string;
}

interface CreateDepartmentInput {
  name: string;
  departmentCode?: string;
  description?: string;
  location?: string;
  hodEmployeeId?: string;
  establishedDate?: string;
  status?: string;
}

interface DepartmentResult {
  errorCode: "success" | "duplicate_entry" | "not_found" | "invalid_hod";
  result: departmentDto | null;
}

// Only a currently-active employee (in the same tenant) can be set as HOD —
// enforced here so a resigned/terminated employee can never even be
// assigned in the first place, not just cleared out after the fact (see
// employee-service.ts's status-change side effect for that half).
const hodEmployeeIsActive = async (
  hodEmployeeId: string,
  tenant: Record<string, unknown>
): Promise<boolean> => {
  const employee = await EmployeeModel.findOne({
    _id: hodEmployeeId,
    ...tenant,
    isDeleted: { $ne: true },
  }).select("status").lean();
  return Boolean(employee) && employee?.status === "active";
};

const create = async (
  data: CreateDepartmentInput,
  scope: TenantScope,
  createdBy: string
): Promise<DepartmentResult> => {
  if (data.hodEmployeeId && !(await hodEmployeeIsActive(data.hodEmployeeId, { adminId: scope.adminId, merchantId: scope.merchantId }))) {
    return { errorCode: "invalid_hod", result: null };
  }

  if (data.departmentCode) {
    const existing = await DepartmentModel.findOne({
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      departmentCode: data.departmentCode,
      isDeleted: { $ne: true },
    }).select("_id").lean();
    if (existing) {
      return { errorCode: "duplicate_entry", result: null };
    }
  }

  const department = await DepartmentModel.create({
    name: data.name,
    departmentCode: data.departmentCode || null,
    description: data.description || null,
    location: data.location || null,
    hodEmployeeId: data.hodEmployeeId || null,
    establishedDate: data.establishedDate ? new Date(data.establishedDate) : null,
    status: data.status || "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  await department.populate("hodEmployeeId", "first_name last_name email phone status");

  return { errorCode: "success", result: mapDbToDto(department) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: DepartmentListOptions = {}
): Promise<{ totalCount: number; result: departmentDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["name", "departmentCode"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status" }),
  };

  const data = await DepartmentModel.find(query)
    .populate("hodEmployeeId", "first_name last_name email phone status")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await DepartmentModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<departmentDto | null> => {
  const data = await DepartmentModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } })
    .populate("hodEmployeeId", "first_name last_name email phone status")
    .lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateDepartmentInput>,
  filter: Record<string, unknown>
): Promise<DepartmentResult> => {
  if (data.hodEmployeeId && !(await hodEmployeeIsActive(data.hodEmployeeId, filter))) {
    return { errorCode: "invalid_hod", result: null };
  }

  const updatePayload: Record<string, unknown> = { ...data };
  if (data.establishedDate) {
    updatePayload.establishedDate = new Date(data.establishedDate);
  }

  const updated = await DepartmentModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: updatePayload },
    { new: true }
  )
    .populate("hodEmployeeId", "first_name last_name email phone status")
    .lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }
  return { errorCode: "success", result: mapDbToDto(updated) };
};

export interface DeleteDepartmentResult {
  errorCode: "success" | "not_found" | "in_use";
}

// A department still referenced by any active employee is blocked from
// deletion — mirrors the in-use guard Warehouse already applies before a
// delete (MSG_WAREHOUSE_HAS_STOCK); previously missing here, so a deleted
// department silently vanished from pickers while still-active employees
// kept a dangling reference to it.
const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<DeleteDepartmentResult> => {
  const department = await DepartmentModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } }).lean();
  if (!department) {
    return { errorCode: "not_found" };
  }
  const inUse = await EmployeeModel.countDocuments({
    departmentId: id,
    adminId: department.adminId,
    merchantId: department.merchantId,
    isDeleted: { $ne: true },
  });
  if (inUse > 0) {
    return { errorCode: "in_use" };
  }
  await DepartmentModel.findOneAndUpdate({ _id: id, ...filter }, { $set: { isDeleted: true } });
  return { errorCode: "success" };
};

export { create, getAll, get, update, deleteByID };
