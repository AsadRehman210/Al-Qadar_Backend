import { categoryDto } from "../../dtos/inventory/category-dto";
import { ICategoryModel } from "../../../model/inventory/category-model";

const mapDbToDto = (dbModel: ICategoryModel): categoryDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    name: dbModel.name || null,
    description: dbModel.description || null,
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ICategoryModel[]): categoryDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
