import { employeeDto } from "../../dtos/employee/employee-dto";
import { IEmployeeModel } from "../../../model/employee/employee-model";

// When departmentId/designationId were `.populate()`d by the caller, Mongoose
// swaps the bare ObjectId for the populated subdocument — pull the name out
// of it, but keep working normally against the unpopulated (plain id) case.
const populatedName = (value: unknown, nameField: string): string | null => {
  const doc = value as Record<string, unknown> | null;
  return doc && typeof doc === "object" && nameField in doc ? (doc[nameField] as string) || null : null;
};

const mapDbToDto = (dbModel: IEmployeeModel): employeeDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    employeeCode: dbModel.employeeCode || null,
    first_name: dbModel.first_name || null,
    last_name: dbModel.last_name || null,
    email: dbModel.email || null,
    phone: dbModel.phone || null,
    gender: dbModel.gender || null,
    dob: dbModel.dob || null,
    address: dbModel.address || null,
    emergency_contact: dbModel.emergency_contact || null,
    blood_group: dbModel.blood_group || null,
    marital_status: dbModel.marital_status || null,
    nationality: dbModel.nationality || null,
    national_id: dbModel.national_id || null,
    national_id_expiry: dbModel.national_id_expiry || null,
    nationality_type: dbModel.nationality_type || null,
    work_permit_no: dbModel.work_permit_no || null,
    work_permit_expiry: dbModel.work_permit_expiry || null,
    image: dbModel.image || null,

    departmentId: dbModel.departmentId
      ? String((dbModel.departmentId as any)?._id || dbModel.departmentId)
      : null,
    departmentName: populatedName(dbModel.departmentId, "name"),
    designationId: dbModel.designationId
      ? String((dbModel.designationId as any)?._id || dbModel.designationId)
      : null,
    designationName: populatedName(dbModel.designationId, "title"),
    weekly_schedule: dbModel.weekly_schedule || [],
    weeklyScheduleHistory: dbModel.weeklyScheduleHistory || [],
    joining_date: dbModel.joining_date || null,
    managerEmployeeId: dbModel.managerEmployeeId ? String(dbModel.managerEmployeeId) : null,
    work_location: dbModel.work_location || null,
    employment_type: dbModel.employment_type || null,
    probation_end: dbModel.probation_end || null,
    status: dbModel.status || null,
    resignation_date: dbModel.resignation_date || null,
    retirement_date: dbModel.retirement_date || null,
    termination_date: dbModel.termination_date || null,
    last_seen_date: dbModel.last_seen_date || null,

    education: dbModel.education || [],
    certificates: dbModel.certificates || [],
    skills: dbModel.skills || [],
    documents: dbModel.documents || null,

    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IEmployeeModel[]): employeeDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
