import { roleDto } from "../../dtos/role/role-dto";
import { IRoleModel } from "../../../model/role/role-model";

const mapDbToDto = (dbModel: IRoleModel & { userCount?: number }): roleDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    role_name: dbModel.role_name || null,
    permissions: Array.isArray(dbModel.permissions) ? dbModel.permissions : [],
    status: dbModel.status || null,
    userCount: typeof dbModel.userCount === "number" ? dbModel.userCount : null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: (IRoleModel & { userCount?: number })[]): roleDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
