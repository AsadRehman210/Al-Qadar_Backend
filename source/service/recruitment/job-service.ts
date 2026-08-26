import { JobModel } from "../../model/recruitment/job-model";
import { DepartmentModel } from "../../model/department/department-model";
import { DesignationModel } from "../../model/designation/designation-model";
import { CandidateModel } from "../../model/recruitment/candidate-model";
import { jobDto } from "../../utility/dtos/recruitment/job-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/recruitment/job-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";
import { getTenantCurrency } from "../account/account-service";

export interface JobListOptions {
  search?: string;
  status?: string;
  departmentId?: string;
}

interface CreateJobInput {
  departmentId: string;
  designationId: string;
  openings?: number;
  deadline?: string;
  salaryMin?: number;
  salaryMax?: number;
  experience?: string;
  description?: string;
  requirements?: string;
}

type JobErrorCode = "success" | "invalid_department" | "invalid_designation" | "not_found";

interface JobResult {
  errorCode: JobErrorCode;
  result: jobDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const generateJobCode = async (scope: TenantScope): Promise<string> => {
  const count = await JobModel.countDocuments({ adminId: scope.adminId, merchantId: scope.merchantId });
  return `JOB-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
};

const create = async (data: CreateJobInput, scope: TenantScope, createdBy: string): Promise<JobResult> => {
  const department = await DepartmentModel.findOne({ _id: data.departmentId, ...inTenant(scope) }).lean();
  if (!department) return { errorCode: "invalid_department", result: null };

  const designation = await DesignationModel.findOne({
    _id: data.designationId,
    departmentId: data.departmentId,
    ...inTenant(scope),
  }).lean();
  if (!designation) return { errorCode: "invalid_designation", result: null };

  const jobCode = await generateJobCode(scope);
  const currency = await getTenantCurrency(scope);
  const job = await JobModel.create({
    jobCode,
    title: designation.title,
    departmentId: data.departmentId,
    designationId: data.designationId,
    openings: data.openings || 1,
    status: "Open",
    deadline: data.deadline ? new Date(data.deadline) : null,
    salaryMin: data.salaryMin || 0,
    salaryMax: data.salaryMax || 0,
    currency,
    experience: data.experience || null,
    description: data.description || null,
    requirements: data.requirements || null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(job) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: JobListOptions = {}
): Promise<{ totalCount: number; result: jobDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    isDeleted: { $ne: true },
    ...buildSearchCondition(options.search, ["title", "jobCode"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status", departmentId: "departmentId" }),
  };

  const data = await JobModel.find(query)
    .populate("departmentId", "name")
    .populate("designationId", "title")
    .skip(startIndex)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();
  const count = await JobModel.countDocuments(query);

  const jobIds = data.map((d) => d._id);
  const counts = await CandidateModel.aggregate([
    { $match: { jobId: { $in: jobIds }, isDeleted: { $ne: true } } },
    { $group: { _id: "$jobId", total: { $sum: 1 }, hired: { $sum: { $cond: [{ $eq: ["$stage", "Hired"] }, 1, 0] } } } },
  ]);
  const countsByJob = Object.fromEntries(counts.map((c) => [String(c._id), c]));

  const result = mapDbListToDtoList(data).map((dto) => ({
    ...dto,
    candidateCount: countsByJob[dto.id]?.total || 0,
    hiredCount: countsByJob[dto.id]?.hired || 0,
  }));

  return { totalCount: count, result };
};

interface JobSummary {
  totalJobs: number;
  openJobs: number;
  inProcessCandidates: number;
  hiredCandidates: number;
}

// Tenant-wide totals independent of pagination/search — used for the list
// page's stat cards.
const getSummary = async (filter: Record<string, unknown>): Promise<JobSummary> => {
  const base = { ...filter, isDeleted: { $ne: true } };
  const [totalJobs, openJobs, hiredCandidates, inProcessCandidates] = await Promise.all([
    JobModel.countDocuments(base),
    JobModel.countDocuments({ ...base, status: "Open" }),
    CandidateModel.countDocuments({ ...base, stage: "Hired" }),
    CandidateModel.countDocuments({ ...base, stage: { $nin: ["Hired", "Rejected"] } }),
  ]);
  return { totalJobs, openJobs, inProcessCandidates, hiredCandidates };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<jobDto | null> => {
  const data = await JobModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } })
    .populate("departmentId", "name")
    .populate("designationId", "title")
    .lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateJobInput> & { status?: string },
  filter: Record<string, unknown>
): Promise<JobResult> => {
  const updatePayload: Record<string, unknown> = { ...data };
  // Currency is locked to the tenant's own account currency — never
  // updatable via this endpoint no matter what the client sends.
  delete updatePayload.currency;
  if (data.deadline) updatePayload.deadline = new Date(data.deadline);

  if (data.designationId) {
    const designation = await DesignationModel.findOne({
      _id: data.designationId,
      departmentId: data.departmentId,
      ...filter,
    }).lean();
    if (!designation) return { errorCode: "invalid_designation", result: null };
    updatePayload.title = designation.title;
  }

  const updated = await JobModel.findOneAndUpdate(
    { _id: id, ...filter, isDeleted: { $ne: true } },
    { $set: updatePayload },
    { new: true }
  ).lean();
  if (!updated) return { errorCode: "not_found", result: null };
  return { errorCode: "success", result: mapDbToDto(updated) };
};

// Marks the job Closed once every open position has been filled — called by
// the candidate-hire flow right after a candidate is marked Hired.
const closeIfPositionsFilled = async (jobId: string): Promise<void> => {
  const job = await JobModel.findById(jobId);
  if (!job || job.status === "Closed") return;

  const hiredCount = await CandidateModel.countDocuments({ jobId, stage: "Hired", isDeleted: { $ne: true } });
  if (hiredCount >= (job.openings || 1)) {
    job.status = "Closed";
    await job.save();
  }
};

export { create, getAll, getSummary, get, update, closeIfPositionsFilled };
