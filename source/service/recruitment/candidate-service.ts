import { CandidateModel } from "../../model/recruitment/candidate-model";
import { JobModel } from "../../model/recruitment/job-model";
import { candidateDto } from "../../utility/dtos/recruitment/candidate-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/recruitment/candidate-mapper";
import { TenantScope } from "../../utility/helper/tenant-scope";
import * as employeeService from "../employee/employee-service";
import * as onboardingService from "../onboarding/onboarding-service";
import * as jobService from "./job-service";
import { onboardingDto } from "../../utility/dtos/onboarding/onboarding-dto";

interface ApplyInput {
  jobId: string;
  name: string;
  email?: string;
  phone?: string;
  experience?: string;
  currentCompany?: string;
  notes?: string;
}

type CandidateErrorCode = "success" | "invalid_job" | "not_found";

interface CandidateResult {
  errorCode: CandidateErrorCode;
  result: candidateDto | null;
}

const inTenant = (scope: TenantScope) => ({
  adminId: scope.adminId,
  merchantId: scope.merchantId,
  isDeleted: { $ne: true },
});

const apply = async (data: ApplyInput, scope: TenantScope, createdBy: string): Promise<CandidateResult> => {
  const job = await JobModel.findOne({ _id: data.jobId, ...inTenant(scope) }).lean();
  if (!job) return { errorCode: "invalid_job", result: null };

  const candidate = await CandidateModel.create({
    jobId: data.jobId,
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    experience: data.experience || null,
    currentCompany: data.currentCompany || null,
    stage: "Applied",
    notes: data.notes || null,
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });

  return { errorCode: "success", result: mapDbToDto(candidate) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number
): Promise<{ totalCount: number; result: candidateDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = { ...filter, isDeleted: { $ne: true } };

  const data = await CandidateModel.find(query).skip(startIndex).limit(limit).sort({ _id: -1 }).lean();
  const count = await CandidateModel.countDocuments(query);
  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const getByJob = async (jobId: string, filter: Record<string, unknown>): Promise<candidateDto[]> => {
  const data = await CandidateModel.find({ jobId, ...filter, isDeleted: { $ne: true } }).sort({ _id: -1 }).lean();
  return mapDbListToDtoList(data);
};

const findCandidate = async (id: string, filter: Record<string, unknown>) =>
  CandidateModel.findOne({ _id: id, ...filter, isDeleted: { $ne: true } });

const updateStage = async (
  id: string,
  stage: string,
  filter: Record<string, unknown>
): Promise<CandidateResult> => {
  const candidate = await findCandidate(id, filter);
  if (!candidate) return { errorCode: "not_found", result: null };

  candidate.stage = stage as candidateDto["stage"];
  await candidate.save();
  return { errorCode: "success", result: mapDbToDto(candidate) };
};

interface HireInput {
  joiningDate?: string;
}

type HireErrorCode =
  | "success"
  | "not_found"
  | "invalid_job"
  | "positions_filled"
  | "invalid_department"
  | "invalid_designation"
  | "invalid_manager"
  | "manager_cycle"
  | "invalid_weekly_schedule"
  | "duplicate_entry";

interface HireResult {
  errorCode: HireErrorCode;
  result: { candidate: candidateDto; employeeId: string; onboarding: onboardingDto | null } | null;
}

/**
 * Orchestrates the Recruitment → Employee → Onboarding bridge: creates a
 * real Employee (status: probation) from the candidate's details, flips the
 * candidate to "Hired", and starts their onboarding checklist in one call —
 * this is the linked flow the Talent Cycle is built around.
 */
const hire = async (
  id: string,
  data: HireInput,
  scope: TenantScope,
  createdBy: string
): Promise<HireResult> => {
  const candidate = await findCandidate(id, inTenant(scope));
  if (!candidate) return { errorCode: "not_found", result: null };

  const job = await JobModel.findOne({ _id: candidate.jobId, ...inTenant(scope) }).lean();
  if (!job || !job.departmentId || !job.designationId) return { errorCode: "invalid_job", result: null };

  const existingOnboarding = await onboardingService.getByCandidate(id, inTenant(scope));
  if (existingOnboarding) {
    return {
      errorCode: "success",
      result: { candidate: mapDbToDto(candidate), employeeId: existingOnboarding.employeeId || "", onboarding: existingOnboarding },
    };
  }

  // The job posting itself carries the designation/department the role was
  // opened for — hiring can't put more people in a job than it has openings.
  const hiredCount = await CandidateModel.countDocuments({
    jobId: job._id,
    stage: "Hired",
    isDeleted: { $ne: true },
  });
  if (hiredCount >= (job.openings || 1)) {
    return { errorCode: "positions_filled", result: null };
  }

  const [first_name, ...rest] = (candidate.name || "").trim().split(/\s+/);
  const employeeResult = await employeeService.create(
    {
      first_name: first_name || candidate.name || "New Hire",
      last_name: rest.join(" ") || undefined,
      email: candidate.email || undefined,
      phone: candidate.phone || undefined,
      departmentId: String(job.departmentId),
      designationId: String(job.designationId),
      joining_date: data.joiningDate || undefined,
      status: "probation",
    },
    scope,
    createdBy
  );

  if (employeeResult.errorCode !== "success" || !employeeResult.result) {
    return { errorCode: employeeResult.errorCode, result: null };
  }

  candidate.stage = "Hired";
  await candidate.save();
  await jobService.closeIfPositionsFilled(String(job._id));

  const onboardingResult = await onboardingService.create(
    {
      employeeId: employeeResult.result.id,
      candidateId: id,
      jobId: candidate.jobId ? String(candidate.jobId) : undefined,
      joiningDate: data.joiningDate,
    },
    scope,
    createdBy
  );

  return {
    errorCode: "success",
    result: {
      candidate: mapDbToDto(candidate),
      employeeId: employeeResult.result.id,
      onboarding: onboardingResult.result,
    },
  };
};

export { apply, getAll, getByJob, updateStage, hire };
