import { assetCategoryDto } from "../../dtos/asset/asset-category-dto";
import { IAssetCategoryModel } from "../../../model/asset/asset-category-model";

const mapDbToDto = (dbModel: IAssetCategoryModel): assetCategoryDto => ({
  id: dbModel._id ? String(dbModel._id) : "",
  code: dbModel.code || null,
  name: dbModel.name || null,
  description: dbModel.description || null,
  status: dbModel.status || null,
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
});

const mapDbListToDtoList = (dbModels: IAssetCategoryModel[]): assetCategoryDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
