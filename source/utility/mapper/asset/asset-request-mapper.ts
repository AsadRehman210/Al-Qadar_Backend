import { assetRequestDto } from "../../dtos/asset/asset-request-dto";
import { IAssetRequestModel } from "../../../model/asset/asset-request-model";

const populatedField = <T extends Record<string, unknown>>(value: unknown): T | null => {
  return value && typeof value === "object" && "_id" in (value as Record<string, unknown>) ? (value as T) : null;
};

const employeeFullName = (emp: { first_name?: string; last_name?: string } | null): string | null => {
  if (!emp) return null;
  return [emp.first_name, emp.last_name].filter(Boolean).join(" ") || null;
};

const mapDbToDto = (dbModel: IAssetRequestModel): assetRequestDto => {
  const employee = populatedField<{ _id: unknown; first_name?: string; last_name?: string }>(dbModel.employeeId);
  const category = populatedField<{ _id: unknown; name?: string }>(dbModel.categoryId);

  return {
    id: dbModel._id ? String(dbModel._id) : "",
    employeeId: employee ? String(employee._id) : dbModel.employeeId ? String(dbModel.employeeId) : null,
    employeeName: employeeFullName(employee),
    categoryId: category ? String(category._id) : dbModel.categoryId ? String(dbModel.categoryId) : null,
    categoryName: category?.name || null,
    justification: dbModel.justification || null,
    priority: dbModel.priority || null,
    status: dbModel.status || null,
    requestedDate: dbModel.requestedDate || null,
    decidedBy: dbModel.decidedBy ? String(dbModel.decidedBy) : null,
    decidedDate: dbModel.decidedDate || null,
    decisionNotes: dbModel.decisionNotes || null,
    fulfilledAssetId: dbModel.fulfilledAssetId ? String(dbModel.fulfilledAssetId) : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IAssetRequestModel[]): assetRequestDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
