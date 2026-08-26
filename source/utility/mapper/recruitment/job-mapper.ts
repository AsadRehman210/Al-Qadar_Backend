import { jobDto } from "../../dtos/recruitment/job-dto";
import { IJobModel } from "../../../model/recruitment/job-model";

const populatedDepartmentName = (value: unknown): string | null => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  return (doc.name as string) || null;
};

const populatedDesignationTitle = (value: unknown): string | null => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  return (doc.title as string) || null;
};

const mapDbToDto = (dbModel: IJobModel): jobDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    jobCode: dbModel.jobCode || null,
    title: dbModel.title || null,
    departmentId: dbModel.departmentId ? String((dbModel.departmentId as any)?._id || dbModel.departmentId) : null,
    departmentName: populatedDepartmentName(dbModel.departmentId),
    designationId: dbModel.designationId ? String((dbModel.designationId as any)?._id || dbModel.designationId) : null,
    designationTitle: populatedDesignationTitle(dbModel.designationId),
    openings: dbModel.openings ?? null,
    status: dbModel.status || null,
    deadline: dbModel.deadline || null,
    salaryMin: dbModel.salaryMin ?? null,
    salaryMax: dbModel.salaryMax ?? null,
    currency: dbModel.currency || null,
    experience: dbModel.experience || null,
    description: dbModel.description || null,
    requirements: dbModel.requirements || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IJobModel[]): jobDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
