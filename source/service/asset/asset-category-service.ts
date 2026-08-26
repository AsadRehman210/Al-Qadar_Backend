import { AssetCategoryModel } from "../../model/asset/asset-category-model";
import { AssetModel } from "../../model/asset/asset-model";
import { TenantScope } from "../../utility/helper/tenant-scope";
import { assetCategoryDto } from "../../utility/dtos/asset/asset-category-dto";
import { mapDbToDto, mapDbListToDtoList } from "../../utility/mapper/asset/asset-category-mapper";
import { buildSearchCondition, buildExactFilters } from "../../utility/helper/list-query";

export interface AssetCategoryListOptions {
  search?: string;
  status?: string;
}

interface CreateAssetCategoryInput {
  code: string;
  name: string;
  description?: string;
  status?: string;
}

interface AssetCategoryResult {
  errorCode: "success" | "not_found" | "code_exists" | "in_use";
  result: assetCategoryDto | null;
}

const create = async (
  data: CreateAssetCategoryInput,
  scope: TenantScope,
  createdBy: string
): Promise<AssetCategoryResult> => {
  const existing = await AssetCategoryModel.findOne({ adminId: scope.adminId, merchantId: scope.merchantId, code: data.code }).select("_id").lean();
  if (existing) {
    return { errorCode: "code_exists", result: null };
  }

  const category = await AssetCategoryModel.create({
    code: data.code,
    name: data.name,
    description: data.description || null,
    status: data.status || "Active",
    adminId: scope.adminId,
    merchantId: scope.merchantId,
    createdBy,
  });
  return { errorCode: "success", result: mapDbToDto(category) };
};

const getAll = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: AssetCategoryListOptions = {}
): Promise<{ totalCount: number; result: assetCategoryDto[] }> => {
  const startIndex = (page - 1) * limit;
  const query = {
    ...filter,
    ...buildSearchCondition(options.search, ["name", "code"]),
    ...buildExactFilters(options as Record<string, unknown>, { status: "status" }),
  };

  const data = await AssetCategoryModel.find(query).skip(startIndex).limit(limit).sort({ name: 1 }).lean();
  const count = await AssetCategoryModel.countDocuments(query);

  return { totalCount: count, result: mapDbListToDtoList(data) };
};

const get = async (id: string, filter: Record<string, unknown>): Promise<assetCategoryDto | null> => {
  const data = await AssetCategoryModel.findOne({ _id: id, ...filter }).lean();
  return data ? mapDbToDto(data) : null;
};

const update = async (
  id: string,
  data: Partial<CreateAssetCategoryInput>,
  filter: Record<string, unknown>
): Promise<AssetCategoryResult> => {
  const existing = await AssetCategoryModel.findOne({ _id: id, ...filter }).select("code adminId merchantId").lean();
  if (!existing) {
    return { errorCode: "not_found", result: null };
  }
  if (data.code !== undefined && data.code !== existing.code) {
    const codeTaken = await AssetCategoryModel.findOne({
      _id: { $ne: id },
      adminId: existing.adminId,
      merchantId: existing.merchantId,
      code: data.code,
    }).select("_id").lean();
    if (codeTaken) {
      return { errorCode: "code_exists", result: null };
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (data.code !== undefined) updatePayload.code = data.code;
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.status !== undefined) updatePayload.status = data.status;

  const updated = await AssetCategoryModel.findOneAndUpdate({ _id: id, ...filter }, { $set: updatePayload }, { new: true }).lean();
  return { errorCode: "success", result: updated ? mapDbToDto(updated) : null };
};

// A category still referenced by any asset is blocked from deletion — the
// exact in-use guard this codebase already applies to Warehouse
// (MSG_WAREHOUSE_HAS_STOCK) but was missing on Department/Designation
// (flagged in this session's HR audit); adding it here from the start.
const deleteByID = async (id: string, filter: Record<string, unknown>): Promise<AssetCategoryResult> => {
  const category = await AssetCategoryModel.findOne({ _id: id, ...filter }).lean();
  if (!category) {
    return { errorCode: "not_found", result: null };
  }
  const inUse = await AssetModel.countDocuments({ categoryId: id, adminId: category.adminId, merchantId: category.merchantId });
  if (inUse > 0) {
    return { errorCode: "in_use", result: null };
  }
  await AssetCategoryModel.deleteOne({ _id: id });
  return { errorCode: "success", result: mapDbToDto(category) };
};

export { create, getAll, get, update, deleteByID };
