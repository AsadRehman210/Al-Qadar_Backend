import { chartOfAccountDto } from "../../dtos/finance/chart-of-account-dto";
import { IChartOfAccountModel } from "../../../model/finance/chart-of-account-model";

const mapDbToDto = (dbModel: IChartOfAccountModel): chartOfAccountDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    code: dbModel.code || null,
    name: dbModel.name || null,
    type: dbModel.type || null,
    subType: dbModel.subType || null,
    parentId: dbModel.parentId ? String(dbModel.parentId) : null,
    status: dbModel.status || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IChartOfAccountModel[]): chartOfAccountDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
