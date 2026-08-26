import { onboardingDto } from "../../dtos/onboarding/onboarding-dto";
import { IOnboardingModel } from "../../../model/onboarding/onboarding-model";
import { populatedEmployeeFields } from "../../helper/list-query";

const populatedName = (value: unknown, nameField: string): string | null => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  return (doc[nameField] as string) || null;
};

const mapDbToDto = (dbModel: IOnboardingModel): onboardingDto => {
  const emp = populatedEmployeeFields(dbModel.employeeId);
  const empDoc = dbModel.employeeId as Record<string, unknown> | null;
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    employeeId: emp.id,
    employeeName: emp.name,
    employeeCode: emp.code,
    department: empDoc && typeof empDoc === "object" ? populatedName(empDoc.departmentId, "name") : null,
    position: empDoc && typeof empDoc === "object" ? populatedName(empDoc.designationId, "title") : null,
    candidateId: dbModel.candidateId ? String(dbModel.candidateId) : null,
    jobId: dbModel.jobId ? String(dbModel.jobId) : null,
    joiningDate: dbModel.joiningDate || null,
    tasks: dbModel.tasks || [],
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IOnboardingModel[]): onboardingDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
