import { OnboardingModel, IOnboardingTask } from "../../model/onboarding/onboarding-model";
import { OnboardingTemplateModel } from "../../model/onboarding/onboarding-template-model";
import { EmployeeModel } from "../../model/employee/employee-model";
import { onboardingDto } from "../../utility/dtos/onboarding/onboarding-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/onboarding/onboarding-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import * as employeeService from "../employee/employee-service";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface OnboardingListOptions {
  search?: string;
  status?: string;
  employeeId?: string;
}

interface CreateOnboardingInput {
  employeeId: string;
  candidateId?: string;
  jobId?: string;
  joiningDate?: string;
}

type OnboardingErrorCode = "success" | "not_found" | "invalid_employee";

interface OnboardingResult {
  errorCode: OnboardingErrorCode;
  result: onboardingDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const computeStatus = (tasks: IOnboardingTask[]): "In Progress" | "Completed" =>
  tasks.filter((t) => t.required).every((t) => t.done) ? "Completed" : "In Progress";

/** Snapshots the tenant's currently-active templates into task rows for a new onboarding record. */
const snapshotTasks = async (scope: TenantScope): Promise<IOnboardingTask[]> => {
  const templates = await OnboardingTemplateModel.find({ ...inTenant(scope), active: true }).sort({ order: 1 }).lean();
  return templates.map((tpl) => ({
    templateId: tpl._id,
    label: tpl.label,
    category: tpl.category,
    required: tpl.required,
    done: false,
    doneAt: null,
  }));
};

const create = async (
  data: CreateOnboardingInput,
  scope: TenantScope,
  createdBy: string
): Promise<OnboardingResult> => {
  const employee = await EmployeeModel.findOne({ _id: data.employeeId, ...inTenant(scope) }).lean();
  if (!employee) return { errorCode: "invalid_employee", result: null };

  const tasks = await snapshotTasks(scope);
  const onboarding = await OnboardingModel.create({
    employeeId: data.employeeId,
    candidateId: data.candidateId || null,
    jobId: data.jobId || null,
    joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
    tasks,
    status: computeStatus(tasks),
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(onboarding) };
};

const findOnboarding = async (id: string, filter: Record<string, unknown>) =>
  OnboardingModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });

/**
 * Flips one task's done state and recomputes the record's overall status.
 * When every required task becomes done, this is what actually takes the
 * linked employee off probation — mirroring how Offboarding drives employee
 * status in the other direction.
 */
const toggleTask = async (
  id: string,
  templateId: string,
  filter: Record<string, unknown>,
  scope: TenantScope
): Promise<OnboardingResult> => {
  const onboarding = await findOnboarding(id, filter);
  if (!onboarding) return { errorCode: "not_found", result: null };

  const wasCompleted = onboarding.status === "Completed";
  const tasks = (onboarding.tasks || []).map((t) => {
    if (String(t.templateId) !== templateId) return t;
    const done = !t.done;
    return {
      templateId: t.templateId,
      label: t.label,
      category: t.category,
      required: t.required,
      done,
      doneAt: done ? new Date() : null,
    };
  });

  onboarding.tasks = tasks;
  onboarding.status = computeStatus(tasks);
  await onboarding.save();

  if (!wasCompleted && onboarding.status === "Completed") {
    const employee = await EmployeeModel.findOne({ _id: onboarding.employeeId, ...inTenant(scope) }).lean();
    if (employee?.status === "probation") {
      await employeeService.update(String(onboarding.employeeId), { status: "active" }, filter, scope);
    }
  }

  return { errorCode: "success", result: mapDbToDto(onboarding) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: OnboardingListOptions = {}
): Promise<{ totalCount: number; result: onboardingDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query: Record<string, unknown> = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildExactFilters(options as Record<string, unknown>, { status: "status", employeeId: "employeeId" }),
  };

  if (options.search) {
    const matches = await EmployeeModel.find(
      { ...filter, ...buildSearchCondition(options.search, ["first_name", "last_name", "employeeCode"]) },
      "_id"
    ).lean();
    query.employeeId = { $in: matches.map((e) => e._id) };
  }

  const data = await OnboardingModel.find(query)
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
  const count = await OnboardingModel.countDocuments(query);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

interface OnboardingSummary {
  total: number;
  inProgress: number;
  completed: number;
}

// Tenant-wide totals independent of pagination/search — used for the list
// page's stat cards.
const getSummary = async (filter: Record<string, unknown>): Promise<OnboardingSummary> => {
  const base = { ...filter, isDeleted: { $ne: true } };
  const [total, inProgress, completed] = await Promise.all([
    OnboardingModel.countDocuments(base),
    OnboardingModel.countDocuments({ ...base, status: "In Progress" }),
    OnboardingModel.countDocuments({ ...base, status: "Completed" }),
  ]);
  return { total, inProgress, completed };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<onboardingDto | null> => {
  const data = await findOnboarding(id, filter);
  return data ? mapDbToDto(data) : null;
};

const getByEmployee = async (employeeId: string, filter: Record<string, unknown>): Promise<onboardingDto | null> => {
  const data = await OnboardingModel.findOne({ employeeId, ...filter, isDeleted: { $ne: true } }).lean();
  return data ? mapDbToDto(data) : null;
};

const getByCandidate = async (candidateId: string, filter: Record<string, unknown>): Promise<onboardingDto | null> => {
  const data = await OnboardingModel.findOne({ candidateId, ...filter, isDeleted: { $ne: true } }).lean();
  return data ? mapDbToDto(data) : null;
};

export { create, toggleTask, getAll, getSummary, get, getByEmployee, getByCandidate };
