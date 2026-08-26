import { departmentDto } from "../../dtos/department/department-dto";
import { IDepartmentModel } from "../../../model/department/department-model";

// The department's HOD is never stored redundantly — it's always the
// currently-populated Employee behind `hodEmployeeId`, so a name/email/phone
// change (or the employee no longer being active, see employee-service.ts)
// is reflected here automatically on the very next read.
const populatedHod = (value: unknown): { name: string | null; email: string | null; phone: string | null } => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return { name: null, email: null, phone: null };
  const name = `${(doc.first_name as string) || ""} ${(doc.last_name as string) || ""}`.trim() || null;
  return { name, email: (doc.email as string) || null, phone: (doc.phone as string) || null };
};

const mapDbToDto = (dbModel: IDepartmentModel): departmentDto => {
  const hod = populatedHod(dbModel.hodEmployeeId);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    name: dbModel.name || null,
    departmentCode: dbModel.departmentCode || null,
    description: dbModel.description || null,
    location: dbModel.location || null,
    hodEmployeeId: dbModel.hodEmployeeId ? String((dbModel.hodEmployeeId as any)?._id || dbModel.hodEmployeeId) : null,
    hodName: hod.name,
    hodEmail: hod.email,
    hodPhone: hod.phone,
    establishedDate: dbModel.establishedDate || null,
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IDepartmentModel[]): departmentDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
