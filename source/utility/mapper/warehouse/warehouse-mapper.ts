import { warehouseDto } from "../../dtos/warehouse/warehouse-dto";
import { IWarehouseModel } from "../../../model/warehouse/warehouse-model";

const mapDbToDto = (dbModel: IWarehouseModel): warehouseDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    code: dbModel.code || null,
    name: dbModel.name || null,
    location: dbModel.location || null,
    manager: dbModel.manager || null,
    capacity: dbModel.capacity ?? null,
    unit: dbModel.unit || null,
    description: dbModel.description || null,
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IWarehouseModel[]): warehouseDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
