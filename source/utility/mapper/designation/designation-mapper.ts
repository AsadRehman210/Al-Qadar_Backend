import { designationDto } from "../../dtos/designation/designation-dto";
import { IDesignationModel } from "../../../model/designation/designation-model";

// When `departmentId` was `.populate()`d by the caller, Mongoose swaps the
// bare ObjectId for the populated subdocument — pull the name out of it,
// but keep working normally against the unpopulated (plain id) case.
const populatedDepartmentName = (dbModel: IDesignationModel): string | null => {
  const dept = dbModel.departmentId as unknown as { name?: string } | null;
  return dept && typeof dept === "object" && "name" in dept ? dept.name || null : null;
};

const mapDbToDto = (dbModel: IDesignationModel): designationDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    title: dbModel.title || null,
    code: dbModel.code || null,
    shortName: dbModel.shortName || null,
    departmentId: dbModel.departmentId ? String((dbModel.departmentId as any)?._id || dbModel.departmentId) : null,
    departmentName: populatedDepartmentName(dbModel),
    level: dbModel.level || null,
    grade: dbModel.grade || null,
    minSalary: dbModel.minSalary ?? null,
    maxSalary: dbModel.maxSalary ?? null,
    overtimeRate: dbModel.overtimeRate ?? null,
    currency: dbModel.currency || null,
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IDesignationModel[]): designationDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
