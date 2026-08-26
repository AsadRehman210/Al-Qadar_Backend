import {
  EmployeeModel,
  IEducation,
  ICertificate,
  ISkill,
  IEmployeeDocuments,
  IWeeklyScheduleDay,
  IWeeklyScheduleHistoryEntry,
  EmployeeStatus,
  DEFAULT_WEEKLY_SCHEDULE,
} from "../../model/employee/employee-model";
import { DepartmentModel } from "../../model/department/department-model";
import { DesignationModel } from "../../model/designation/designation-model";
import { SalaryModel } from "../../model/salary/salary-model";
import { employeeDto } from "../../utility/dtos/employee/employee-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/employee/employee-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

interface CreateEmployeeInput {
  employeeCode?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  address?: string;
  emergency_contact?: string;
  blood_group?: string;
  marital_status?: string;
  nationality?: string;
  national_id?: string;
  national_id_expiry?: string;
  nationality_type?: string;
  work_permit_no?: string;
  work_permit_expiry?: string;
  image?: string;

  departmentId: string;
  designationId: string;
  weekly_schedule?: IWeeklyScheduleDay[];
  joining_date?: string;
  managerEmployeeId?: string;
  work_location?: string;
  employment_type?: string;
  probation_end?: string;
  status?: EmployeeStatus;
  resignation_date?: string;
  retirement_date?: string;
  termination_date?: string;
  last_seen_date?: string;

  education?: IEducation[];
  certificates?: ICertificate[];
  skills?: ISkill[];
  documents?: IEmployeeDocuments;
}

type EmployeeErrorCode =
  | "success"
  | "not_found"
  | "invalid_department"
  | "invalid_designation"
  | "invalid_manager"
  | "manager_cycle"
  | "invalid_weekly_schedule"
  | "duplicate_entry";

interface EmployeeResult {
  errorCode: EmployeeErrorCode;
  result: employeeDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const departmentExists = async (departmentId: string, scope: TenantScope): Promise<boolean> => {
  const department = await DepartmentModel.findOne({ _id: departmentId, ...inTenant(scope) }).select("_id").lean();
  return Boolean(department);
};

const designationExists = async (designationId: string, scope: TenantScope): Promise<boolean> => {
  const designation = await DesignationModel.findOne({ _id: designationId, ...inTenant(scope) }).select("_id").lean();
  return Boolean(designation);
};

// At least one working day, and every working day's start must be before
// its end — mirrors the frontend's own isWeeklyScheduleValid check.
const isWeeklyScheduleValid = (schedule?: IWeeklyScheduleDay[]): boolean => {
  if (!schedule || !schedule.length) return true; // absent -> model default applies
  const hasWorkingDay = schedule.some((d) => d.isWorking);
  if (!hasWorkingDay) return false;
  return schedule.every((d) => !d.isWorking || (d.start && d.end && d.start < d.end));
};

const schedulesEqual = (a?: IWeeklyScheduleDay[], b?: IWeeklyScheduleDay[]): boolean => {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((day, i) => {
    const other = b[i];
    return (
      other &&
      day.day === other.day &&
      Boolean(day.isWorking) === Boolean(other.isWorking) &&
      (day.start || null) === (other.start || null) &&
      (day.end || null) === (other.end || null)
    );
  });
};

const managerExists = async (managerEmployeeId: string, scope: TenantScope): Promise<boolean> => {
  const manager = await EmployeeModel.findOne({ _id: managerEmployeeId, ...inTenant(scope) }).select("_id").lean();
  return Boolean(manager);
};

// Walks the proposed manager's own chain looking for `employeeId` — catches
// both direct self-reference (managerEmployeeId === employeeId, employeeId
// undefined on create so that case can't occur there) and an indirect cycle
// (A's manager is B, B's manager is being set to A). Without this, Org
// Chart's recursive tree render (admin/src/pages/OrgChart/index.jsx) has no
// visited-set guard and stack-overflows on any cyclic chain.
const wouldCreateManagerCycle = async (
  employeeId: string | undefined,
  managerEmployeeId: string,
  scope: TenantScope
): Promise<boolean> => {
  if (!employeeId) return false;
  if (managerEmployeeId === employeeId) return true;

  let currentId: string | null = managerEmployeeId;
  const visited = new Set<string>();
  while (currentId) {
    if (visited.has(currentId)) return false; // pre-existing unrelated cycle, not ours to fix here
    visited.add(currentId);
    const current: { managerEmployeeId?: unknown } | null = await EmployeeModel.findOne(
      { _id: currentId, ...inTenant(scope) },
      { managerEmployeeId: 1 }
    ).lean();
    if (!current || !current.managerEmployeeId) return false;
    const nextId: string = String(current.managerEmployeeId);
    if (nextId === employeeId) return true;
    currentId = nextId;
  }
  return false;
};

const generateEmployeeCode = async (scope: TenantScope): Promise<string> => {
  const count = await EmployeeModel.countDocuments({ adminId: scope.adminId, merchantId: scope.merchantId });
  return `EMP-${String(count + 1).padStart(4, "0")}`;
};

const validateReferences = async (
  data: Partial<CreateEmployeeInput>,
  scope: TenantScope,
  employeeId?: string
): Promise<EmployeeErrorCode | null> => {
  if (data.departmentId && !(await departmentExists(data.departmentId, scope))) {
    return "invalid_department";
  }
  if (data.designationId && !(await designationExists(data.designationId, scope))) {
    return "invalid_designation";
  }
  if (data.managerEmployeeId && !(await managerExists(data.managerEmployeeId, scope))) {
    return "invalid_manager";
  }
  if (data.managerEmployeeId && (await wouldCreateManagerCycle(employeeId, data.managerEmployeeId, scope))) {
    return "manager_cycle";
  }
  if (!isWeeklyScheduleValid(data.weekly_schedule)) {
    return "invalid_weekly_schedule";
  }
  return null;
};

const create = async (
  data: CreateEmployeeInput,
  scope: TenantScope,
  createdBy: string
): Promise<EmployeeResult> => {
  const invalidRef = await validateReferences(data, scope);
  if (invalidRef) {
    return { errorCode: invalidRef, result: null };
  }

  if (data.employeeCode) {
    const existing = await EmployeeModel.findOne({
      adminId: scope.adminId,
      merchantId: scope.merchantId,
      employeeCode: data.employeeCode,
      isDeleted: { $ne: true },
    }).select("_id").lean();
    if (existing) {
      return { errorCode: "duplicate_entry", result: null };
    }
  }

  const employeeCode = data.employeeCode || (await generateEmployeeCode(scope));

  const employee = await EmployeeModel.create({
    ...data,
    employeeCode,
    managerEmployeeId: data.managerEmployeeId || null,
    status: data.status || "probation",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(employee) };
};

export interface EmployeeListOptions {
  search?: string;
  status?: string;
  departmentId?: string;
  designationId?: string;
}

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: EmployeeListOptions = {}
): Promise<{ totalCount: number; result: employeeDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["first_name", "last_name", "employeeCode", "email"]),
    ...buildExactFilters(options as Record<string, unknown>, {
      status: "status",
      departmentId: "departmentId",
      designationId: "designationId",
    }),
  };

  const data = await EmployeeModel.find(query)
    .populate("departmentId", "name")
    .populate("designationId", "title")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await EmployeeModel.countDocuments(query);

  // Salary is its own collection (see salary-model.ts) — batch-fetch each
  // listed employee's latest record (by effective_from) rather than a
  // per-row query, and merge net_salary into the DTO for display only.
  const employeeIds = data.map((e) => e._id);
  const salaries = await SalaryModel.find({ employeeId: { $in: employeeIds } }).sort({ effective_from: -1 }).lean();
  const netSalaryByEmployee: Record<string, number | null> = {};
  for (const s of salaries) {
    const key = String(s.employeeId);
    if (!(key in netSalaryByEmployee)) netSalaryByEmployee[key] = s.net_salary ?? null;
  }

  const result = mapDbListToDtoList(data).map((e) => ({
    ...e,
    net_salary: netSalaryByEmployee[e.id] ?? null,
  }));

  return { totalCount: count, result };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<employeeDto | null> => {
  const data = await EmployeeModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } }).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateEmployeeInput>,
  filter: Record<string, unknown>,
  scope: TenantScope
): Promise<EmployeeResult> => {
  const invalidRef = await validateReferences(data, scope, id);
  if (invalidRef) {
    return { errorCode: invalidRef, result: null };
  }

  const updateData: Partial<CreateEmployeeInput> & { weeklyScheduleHistory?: IWeeklyScheduleHistoryEntry[] } = { ...data };

  // Record the schedule that was actually in effect before this change, so
  // the attendance calendar can later tell which days were weekly-off at any
  // given past date instead of applying today's schedule retroactively.
  if (data.weekly_schedule) {
    const existing = await EmployeeModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });
    if (existing && !schedulesEqual(data.weekly_schedule, existing.weekly_schedule)) {
      const history: IWeeklyScheduleHistoryEntry[] = existing.weeklyScheduleHistory
        ? [...existing.weeklyScheduleHistory]
        : [];
      if (history.length === 0) {
        history.push({
          schedule:
            existing.weekly_schedule && existing.weekly_schedule.length
              ? existing.weekly_schedule
              : DEFAULT_WEEKLY_SCHEDULE,
          effectiveFrom: existing.joining_date || existing.get("createdAt") || new Date(0),
        });
      }
      history.push({ schedule: data.weekly_schedule, effectiveFrom: new Date() });
      updateData.weeklyScheduleHistory = history;
    }
  }

  const updated = await EmployeeModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: updateData },
    { new: true }
  ).lean();

  if (!updated) {
    return { errorCode: "not_found", result: null };
  }

  // An employee who is no longer active can't remain a department's HOD —
  // clear it wherever they're currently set, so a department's displayed HOD
  // always reflects someone genuinely active (see department-service.ts,
  // which also blocks assigning a non-active employee as HOD in the first
  // place).
  if (data.status && data.status !== "active") {
    await DepartmentModel.updateMany(
      { hodEmployeeId: updated._id, adminId: scope.adminId, merchantId: scope.merchantId },
      { $set: { hodEmployeeId: null } }
    );
  }

  return { errorCode: "success", result: mapDbToDto(updated) };
};

const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<boolean> => {
  const result = await EmployeeModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  ).select("_id").lean();
  return Boolean(result);
};

export { create, getAll, get, update, deleteByID };
